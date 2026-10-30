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

  // 1. Tìm task do Admin giao, HOẶC lấy tin nhắn handoff từ Scout
  const { data: adminTask } = await supabase
    .from("tasks")
    .select("*")
    .eq("agent_slug", "builder")
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
    // Nếu không có lệnh Admin, tìm tin nhắn từ Scout
    const { data: scoutMsg } = await supabase
      .from("agent_messages")
      .select("*")
      .eq("to_role", "builder")
      .eq("status", "UNREAD")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (scoutMsg) {
      promptContent = scoutMsg.content;
      inputData = { source: "scout_handoff", message: promptContent };
      
      // Tạo task mới
      const { data: newTask } = await supabase.from("tasks").insert({
        agent_slug: "builder",
        status: "RUNNING",
        model: MODEL,
        is_mock: false,
        assigned_by: "scout",
        input: inputData,
      }).select().single();
      
      task = newTask;
      
      // Đánh dấu tin nhắn của Scout đã đọc
      await supabase.from("agent_messages").update({ status: "READ" }).eq("id", scoutMsg.id);
    } else {
      return NextResponse.json({ ok: true, message: "No tasks for Builder" });
    }
  } else {
    // Nếu có lệnh Admin
    promptContent = task.admin_instruction || "";
    inputData = { mode: "admin_command", instruction: promptContent };
    await supabase.from("tasks").update({ status: "RUNNING", started_at: new Date().toISOString() }).eq("id", task.id);
  }

  const started = Date.now();

  try {
    // 2. Gọi AI để thiết kế Tool
    const groqRes = await fetch(GROQ_API, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${groqKey}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: 'You are a Product Builder AI. Based on the given pain point, design a micro-SaaS tool to solve it. Respond strictly with JSON: {"product": {"name": "...", "slug": "url-friendly-slug", "description": "1 short sentence", "price_usd": 9.00, "features": ["feature 1", "feature 2"]}}',
          },
          { role: "user", content: `Pain point to solve: ${promptContent}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.4,
      }),
    });

    if (!groqRes.ok) throw new Error(`Groq ${groqRes.status}`);
    const groqData = await groqRes.json();
    const parsed = JSON.parse(groqData.choices?.[0]?.message?.content ?? "{}");
    const productData = parsed.product;

    if (!productData || !productData.slug) throw new Error("AI không tạo được product hợp lệ");

    // 3. Lưu sản phẩm vào DB
    const { error: prodErr } = await supabase.from("products").upsert({
      slug: productData.slug,
      name: productData.name,
      description: productData.description,
      price_usd: productData.price_usd || 9.00,
      active: false, // Chờ Admin duyệt mới active
      created_by_agent: "builder",
    }, { onConflict: "slug" });

    if (prodErr) throw new Error(`Lỗi lưu product: ${prodErr.message}`);

    // 4. Cập nhật task SUCCESS
    await supabase.from("tasks").update({
      status: "SUCCESS",
      input: inputData,
      output: { product: productData, features: productData.features },
      finished_at: new Date().toISOString(),
    }).eq("id", task.id);

    await supabase.from("agents").update({ status: "IDLE", last_run_at: new Date().toISOString() }).eq("slug", "builder");

    // 5. Handoff cho Writer và Báo cáo Admin
    const reportMsg = `Đã thiết kế xong tool: ${productData.name} ($${productData.price_usd}). Đang chờ viết bài SEO.`;
    
    await supabase.from("agent_messages").insert([
      {
        from_role: "builder",
        to_role: "writer",
        content: `Viết bài SEO cho tool "${productData.name}": ${productData.description}`,
        status: "UNREAD",
      },
      {
        from_role: "builder",
        to_role: "admin",
        content: isAdminTask ? `Báo cáo Sếp: ${reportMsg}` : reportMsg,
        status: "DONE",
      }
    ]);

    return NextResponse.json({
      ok: true,
      task_id: task.id,
      product_name: productData.name,
      duration_ms: Date.now() - started,
    });

  } catch (e: any) {
    const err = e?.message ?? String(e);
    await supabase.from("tasks").update({ status: "FAILED", error: err.slice(0, 500), finished_at: new Date().toISOString() }).eq("id", task.id);
    await supabase.from("agents").update({ status: "ERROR" }).eq("slug", "builder");
    return NextResponse.json({ ok: false, task_id: task.id, error: err }, { status: 500 });
  }
}