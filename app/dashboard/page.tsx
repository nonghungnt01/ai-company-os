import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Agent = { slug: string; name: string; description: string | null; status: string; unlock_mrr_usd: number; last_run_at: string | null; };
type Msg = { from_role: string; to_role: string; content: string; created_at: string; };

const containerStyle: React.CSSProperties = { maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#111" };
const cardStyle: React.CSSProperties = { background: "#fafafa", border: "1px solid #eee", borderRadius: 10, padding: "14px 16px", marginBottom: 10 };

export default async function DashboardPage() {
  const supabase = getSupabase();
  if (!supabase) return <div style={{ padding: 20 }}>Chưa cấu hình Supabase</div>;

  const month = new Date().toISOString().slice(0, 7);

  const [agentsRes, revenueRes, costsRes, msgsRes] = await Promise.all([
    supabase.from("agents").select("slug,name,description,status,unlock_mrr_usd,last_run_at").order("id"),
    supabase.from("v_verified_revenue").select("*").single(),
    supabase.from("costs").select("amount_usd").eq("month", month),
    // Lấy 5 tin nhắn công khai gần nhất (từ Agent gửi cho nhau hoặc cho Admin)
    supabase.from("agent_messages").select("from_role,to_role,content,created_at").eq("status", "DONE").order("created_at", { ascending: false }).limit(5)
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const messages = (msgsRes.data ?? []) as Msg[];
  const mrr = Number(revenueRes.data?.total_usd ?? 0);
  const totalCost = (costsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount_usd), 0);
  
  const activeAgents = agents.filter((a) => ["IDLE", "RUNNING", "ERROR"].includes(a.status));
  const lockedAgents = agents.filter((a) => a.status === "INACTIVE");
  const nextLocked = lockedAgents.find((a) => Number(a.unlock_mrr_usd) > 0);

  return (
    <main style={containerStyle}>
      <header style={{ marginBottom: 20, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800 }}>Trung Tâm Điều Hành AI</h1>
        <p style={{ color: "#666", fontSize: 13 }}>Cập nhật: {new Date().toLocaleString("vi-VN")}</p>
      </header>

      <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 24 }}>
        <div style={{...cardStyle, textAlign: "center"}}><div style={{ fontSize: 11, color: "#888" }}>Doanh thu</div><div style={{ fontSize: 18, fontWeight: 700 }}>${mrr.toFixed(2)}</div></div>
        <div style={{...cardStyle, textAlign: "center"}}><div style={{ fontSize: 11, color: "#888" }}>Chi phí</div><div style={{ fontSize: 18, fontWeight: 700 }}>${totalCost.toFixed(2)}</div></div>
        <div style={{...cardStyle, textAlign: "center"}}><div style={{ fontSize: 11, color: "#888" }}>Lợi nhuận</div><div style={{ fontSize: 18, fontWeight: 700, color: "#080" }}>${(mrr - totalCost).toFixed(2)}</div></div>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* CỘT TRÁI: AGENTS */}
        <section>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>🤖 Nhân sự ({activeAgents.length}/9)</h2>
          {activeAgents.map((a) => (
            <div key={a.slug} style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ fontSize: 13 }}>{a.name}</strong>
                <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 10, background: a.status === "RUNNING" ? "#d4f4dd" : "#eee" }}>{a.status}</span>
              </div>
              <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>{a.description}</div>
              {a.last_run_at && <div style={{ fontSize: 10, color: "#aaa", marginTop: 4 }}>Lần cuối: {new Date(a.last_run_at).toLocaleTimeString("vi-VN")}</div>}
            </div>
          ))}
        </section>

        {/* CỘT PHẢI: LUỒNG GIAO TIẾP */}
        <section>
          <h2 style={{ fontSize: 15, marginBottom: 10 }}>💬 Báo cáo & Handoff</h2>
          {messages.length === 0 && <p style={{ fontSize: 12, color: "#999" }}>Chưa có hoạt động.</p>}
          {messages.map((m, i) => (
            <div key={i} style={{ ...cardStyle, fontSize: 12, borderLeft: "3px solid #0070f3" }}>
              <div style={{ fontWeight: 600, color: "#0070f3", marginBottom: 4, textTransform: "uppercase", fontSize: 10 }}>
                {m.from_role} → {m.to_role}
              </div>
              <div style={{ color: "#333" }}>{m.content}</div>
              <div style={{ fontSize: 10, color: "#aaa", marginTop: 6, textAlign: "right" }}>{new Date(m.created_at).toLocaleTimeString("vi-VN")}</div>
            </div>
          ))}
        </section>
      </div>

      {nextLocked && (
        <section style={{ ...cardStyle, marginTop: 24, background: "#fff8e6", borderColor: "#ffeeba" }}>
          <h3 style={{ fontSize: 13, marginBottom: 6 }}>🔒 Sắp mở khóa: {nextLocked.name}</h3>
          <p style={{ fontSize: 11, color: "#666" }}>Cần đạt MRR ${Number(nextLocked.unlock_mrr_usd).toFixed(2)} để kích hoạt nhân sự này.</p>
        </section>
      )}
    </main>
  );
}