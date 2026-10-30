import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const [tasksRes, messagesRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id,agent_slug,status,assigned_by,admin_instruction,output,error,started_at,finished_at")
      .order("started_at", { ascending: false })
      .limit(20),
    supabase
      .from("agent_messages")
      .select("id,from_role,to_role,content,status,created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return NextResponse.json({
    tasks: tasksRes.data ?? [],
    messages: messagesRes.data ?? [],
  });
}