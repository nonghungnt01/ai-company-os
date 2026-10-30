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

  const { data: taskRow, error } = await supabase
    .from("tasks")
    .insert({
      agent_slug: agentSlug,
      status: "PENDING",
      assigned_by: "admin",
      admin_instruction: instruction,
      is_mock: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from("agent_messages").insert({
    from_role: "admin",
    to_role: agentSlug,
    content: instruction,
  });

  // KHÔNG trigger ở đây nữa — client sẽ tự gọi
  return NextResponse.json({ ok: true, task_id: taskRow.id, agent_slug: agentSlug });
}