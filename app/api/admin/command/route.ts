import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { agentSlug, instruction } = await req.json();
  if (!agentSlug || !instruction) {
    return NextResponse.json({ error: "Thiếu thông tin" }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.from("tasks").insert({
    agent_slug: agentSlug,
    status: "PENDING",
    assigned_by: "admin",
    admin_instruction: instruction,
    is_mock: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("agent_messages").insert({
    from_role: "admin",
    to_role: agentSlug,
    content: instruction,
  });

  // Trigger agent chạy ngay (fire-and-forget, không đợi kết quả)
  const origin = req.nextUrl.origin;
  fetch(`${origin}/api/agents/${agentSlug}?secret=${process.env.CRON_SECRET}`).catch(
    () => {}
  );

  return NextResponse.json({ ok: true });
}