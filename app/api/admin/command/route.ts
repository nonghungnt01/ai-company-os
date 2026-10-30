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

  // Ghi task vào DB để Agent nhặt lên làm
  const { error } = await supabase.from("tasks").insert({
    agent_slug: agentSlug,
    status: "PENDING", // Trạng thái chờ Agent nhặt
    assigned_by: "admin",
    admin_instruction: instruction,
    is_mock: false,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ghi log tin nhắn
  await supabase.from("agent_messages").insert({
    from_role: "admin",
    to_role: agentSlug,
    content: instruction,
  });

  return NextResponse.json({ ok: true });
}