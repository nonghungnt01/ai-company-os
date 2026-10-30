import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!sbUrl || !sbKey || !groqKey) {
    return NextResponse.json({ error: "missing_env" }, { status: 500 });
  }

  const supabase = createClient(sbUrl, sbKey, { auth: { persistSession: false } });

  // 1. Tìm lệnh Admin hoặc tin nhắn từ Builder
  const { data: adminTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("agent_slug", "writer")
    .eq("assigned_by", "admin")
    .eq("status", "PENDING")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  let task = adminTask;
  let isAdminTask = !!adminTask;
  let promptContent = "";
  let inputData: any = {};

  if (!task) {
    const { data: builderMsg } = await supabase
      .from("agent_messages")
      .select("*")
      .eq("to_role", "writer")
      .eq("status", "UNREAD")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (builderMsg) {
      promptContent = builderMsg.content;
      inputData = { source: "builder_handoff", message: promptContent };
      
      const { data: newTask } = await supabase.from("tasks").insert({
        agent_slug: "writer",
        status: "RUNNING",
        model: MODEL,
        is_mock: false,
        assigned_by: "builder",
        input: inputData,
      }).select().single();
      
      task = newTask;
      await supabase.from("agent_messages").update({ status: "READ" }).eq("id", builderMsg.id);
    } else {
      return NextResponse.json({ ok: true, message: "No tasks for Writer" });
    }
  } else {
    promptContent = task.admin_instruction || "";
    inputData = { mode: "admin_command", instruction: promptContent };
    await supabase.from("tasks").update({ status: "RUNNING", started_at: new Date().toISOString() }).eq("id", task.id);
  }

  const started = Date.now();

  try {
    // 2. Gọi AI viết bài SEO
    const groqRes = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: 'You are an SEO Content Writer. Write an 800-1000 word article in English about the given topic. Include a compelling H1, an intro paragraph with the main keyword, 3-4 H2 sections with actionable advice, and a conclusion with a soft CTA. Respond strictly with JSON: {"article": {"title": "...", "slug": "url-friendly-slug", "content": "Markdown content here"}}',
          },
          { role: "user", content: `Topic: ${promptContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.6,
      }),
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const groqData = await groqRes.json();
    const parsed = JSON.parse(groqData.choices?.[0]?.message?.content ?? "{}");
    const article = parsed.article;

    if (!article || !article.slug) throw new Error("AI không tạo được article hợp lệ");

    // 3. Lưu bài vào DB
    const { error: artErr } = await supabase.from("articles").upsert({
      slug: article.slug,
      title: article.title,
      content: article.content,
      status: "DRAFT",
      created_by_agent: "writer",
    }, { onConflict: "slug" });

    if (artErr) throw new Error(`Lỗi lưu article: ${artErr.message}`);

    // 4. Cập nhật task SUCCESS
    await supabase.from("tasks").update({
      status: "SUCCESS",
      input: inputData,
      output: { article: { title: article.title, slug: article.slug, word_count: article.content.split(/\s+/).length } },
      finished_at: new Date().toISOString(),
    }).eq("id", task.id);

    await supabase.from("agents").update({ status: "IDLE", last_run_at: new Date().toISOString() }).eq("slug", "writer");

    // 5. Handoff cho Closer + báo cáo Admin
    const reportMsg = `Đã viết bài SEO: "${article.title}" (~${article.content.split(/\s+/).length} từ). Đang chờ duyệt publish.`;
    
    await supabase.from("agent_messages").insert([
      {
        from_role: "writer",
        to_role: "closer",
        content: `Bài mới sẵn sàng: ${article.title}. Khi publish cần chuẩn bị email cho leads.`,
        status: "UNREAD",
      },
      {
        from_role: "writer",
        to_role: "admin",
        content: isAdminTask ? `Báo cáo Sếp: ${reportMsg}` : reportMsg,
        status: "DONE",
      }
    ]);

    return NextResponse.json({
      ok: true,
      task_id: task.id,
      article_title: article.title,
      word_count: article.content.split(/\s+/).length,
      duration_ms: Date.now() - started,
    });

  } catch (e: any) {
    const err = e?.message ?? String(e);
    await supabase.from("tasks").update({ status: "FAILED", error: err.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", task.id);
    await supabase.from("agents").update({ status: "ERROR" }).eq("slug", "writer");
    return NextResponse.json({ ok: false, task_id: task.id, error: err }, { status: 500 });
  }
}