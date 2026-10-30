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

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  // 1. Tìm lệnh Admin hoặc tin nhắn từ Writer
  const { data: adminTask } = await supabase.from("tasks").select("*").eq("agent_slug", "closer").eq("assigned_by", "admin").eq("status", "PENDING").order("started_at", { ascending: true }).limit(1).maybeSingle();

  let task = adminTask;
  let isAdminTask = !!adminTask;
  let promptContent = "";
  let inputData: any = {};

  if (!task) {
    const { data: writerMsg } = await supabase.from("agent_messages").select("*").eq("to_role", "closer").eq("status", "UNREAD").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (writerMsg) {
      promptContent = writerMsg.content;
      inputData = { source: "writer_handoff", message: promptContent };
      const { data: newTask } = await supabase.from("tasks").insert({ agent_slug: "closer", status: "RUNNING", model: MODEL, assigned_by: "writer", input: inputData }).select().single();
      task = newTask;
      await supabase.from("agent_messages").update({ status: "READ" }).eq("id", writerMsg.id);
    } else {
      return NextResponse.json({ ok: true, message: "No tasks for Closer" });
    }
  } else {
    promptContent = task.admin_instruction || "";
    inputData = { mode: "admin_command", instruction: promptContent };
    await supabase.from("tasks").update({ status: "RUNNING", started_at: new Date().toISOString() }).eq("id", task.id);
  }

  try {
    // 2. Gọi AI soạn Email
    const groqRes = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: 'You are a B2B Sales Agent. Write a short, non-spammy cold email in English based on the given context. Respond strictly with JSON: {"email": {"subject": "...", "body": "..."}}' },
          { role: "user", content: `Context: ${promptContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.5,
      }),
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const groqData = await groqRes.json();
    const parsed = JSON.parse(groqData.choices?.[0]?.message?.content ?? "{}");
    const email = parsed.email;

    if (!email || !email.subject) throw new Error("AI không tạo được email hợp lệ");

    // Lưu vào bảng emails (chờ duyệt)
    await supabase.from("emails").insert({
      lead_id: 1, // Tạm fix cứng id=1 để test, sau này sẽ map với bảng leads
      subject: email.subject,
      body_preview: email.body,
      status: "DRAFT",
      created_by_agent: "closer"
    });

    // 3. Cập nhật task SUCCESS
    await supabase.from("tasks").update({ status: "SUCCESS", input: inputData, output: { email }, finished_at: new Date().toISOString() }).eq("id", task.id);
    await supabase.from("agents").update({ status: "IDLE", last_run_at: new Date().toISOString() }).eq("slug", "closer");

    // Báo cáo Admin
    await supabase.from("agent_messages").insert({
      from_role: "closer", to_role: "admin",
      content: `Báo cáo Sếp: Đã soạn xong email nháp. Tiêu đề: "${email.subject}". Đang chờ Sếp duyệt để gửi.`,
      status: "DONE",
    });

    return NextResponse.json({ ok: true, task_id: task.id, subject: email.subject });

  } catch (e: any) {
    const err = e?.message ?? String(e);
    await supabase.from("tasks").update({ status: "FAILED", error: err.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", task.id);
    await supabase.from("agents").update({ status: "ERROR" }).eq("slug", "closer");
    return NextResponse.json({ ok: false, task_id: task.id, error: err }, { status: 500 });
  }
}