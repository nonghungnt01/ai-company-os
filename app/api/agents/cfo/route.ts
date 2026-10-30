import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  const month = new Date().toISOString().slice(0, 7);

  // 1. Truy vấn số liệu thực tế
  const { data: rev } = await supabase.from("v_verified_revenue").select("*").single();
  const { data: costs } = await supabase.from("costs").select("amount_usd").eq("month", month);
  const { count: taskCount } = await supabase.from("tasks").select("*", { count: 'exact', head: true }).eq("status", "SUCCESS");
  const { data: products } = await supabase.from("products").select("name").eq("active", true);

  const mrr = Number(rev?.total_usd ?? 0);
  const totalCost = (costs ?? []).reduce((s, r) => s + Number(r.amount_usd), 0);
  const profit = mrr - totalCost;

  // 2. Soạn báo cáo
  const report = `
📊 BÁO CÁO TÀI CHÍNH THÁNG ${month}
- Doanh thu xác minh: $${mrr.toFixed(2)} (${rev?.tx_count || 0} giao dịch)
- Chi phí vận hành: $${totalCost.toFixed(2)}
- Lợi nhuận ròng: $${profit.toFixed(2)}
- Tổng task AI đã hoàn thành: ${taskCount || 0}
- Sản phẩm đang bán: ${(products ?? []).map((p: any) => p.name).join(", ") || "Chưa có"}
  `.trim();

  // 3. Lưu log
  const { data: task } = await supabase.from("tasks").insert({
    agent_slug: "cfo", status: "SUCCESS", assigned_by: "system", model: "none", output: { report, mrr, profit }
  }).select().single();

  await supabase.from("agents").update({ status: "IDLE", last_run_at: new Date().toISOString() }).eq("slug", "cfo");

  await supabase.from("agent_messages").insert({
    from_role: "cfo", to_role: "admin", content: report, status: "DONE",
  });

  return NextResponse.json({ ok: true, report });
}