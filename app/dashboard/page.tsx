import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Agent = {
  slug: string;
  name: string;
  description: string | null;
  status: string;
  unlock_mrr_usd: number;
  last_run_at: string | null;
};

const containerStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: "0 auto",
  padding: "20px 16px 60px",
  fontFamily: "system-ui, -apple-system, sans-serif",
  color: "#111",
};

const cardStyle: React.CSSProperties = {
  background: "#fafafa",
  border: "1px solid #eee",
  borderRadius: 10,
  padding: "14px 16px",
  marginBottom: 10,
};

export default async function DashboardPage() {
  const supabase = getSupabase();

  if (!supabase) {
    return (
      <main style={containerStyle}>
        <h1 style={{ fontSize: 20, marginBottom: 12 }}>Dashboard</h1>
        <div style={{ ...cardStyle, background: "#fff3cd", borderColor: "#ffe08a" }}>
          <p style={{ fontSize: 14, lineHeight: 1.5 }}>
            ⚠️ <strong>Chưa cấu hình Supabase</strong>
            <br />
            Cần thêm 2 biến môi trường vào Vercel:
            <br />
            <code style={codeStyle}>NEXT_PUBLIC_SUPABASE_URL</code>
            <br />
            <code style={codeStyle}>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>
            <br />
            Sau đó Redeploy.
          </p>
        </div>
      </main>
    );
  }

  const month = new Date().toISOString().slice(0, 7);

  const [agentsRes, revenueRes, costsRes] = await Promise.all([
    supabase
      .from("agents")
      .select("slug,name,description,status,unlock_mrr_usd,last_run_at")
      .order("id"),
    supabase.from("v_verified_revenue").select("*").single(),
    supabase.from("costs").select("amount_usd").eq("month", month),
  ]);

  const agents = (agentsRes.data ?? []) as Agent[];
  const mrr = Number(revenueRes.data?.total_usd ?? 0);
  const txCount = Number(revenueRes.data?.tx_count ?? 0);
  const totalCost = (costsRes.data ?? []).reduce(
    (s: number, r: { amount_usd: number }) => s + Number(r.amount_usd),
    0
  );
  const profit = mrr - totalCost;

  const activeAgents = agents.filter(
    (a) => a.status === "IDLE" || a.status === "RUNNING" || a.status === "ERROR"
  );
  const lockedAgents = agents.filter((a) => a.status === "INACTIVE");

  const nextLocked = lockedAgents
    .filter((a) => Number(a.unlock_mrr_usd) > 0)
    .sort((a, b) => Number(a.unlock_mrr_usd) - Number(b.unlock_mrr_usd))[0];

  return (
    <main style={containerStyle}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>AI Company OS</h1>
        <p style={{ color: "#666", fontSize: 12 }}>
          Cập nhật: {new Date().toLocaleString("vi-VN")}
        </p>
      </header>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: 8,
          marginBottom: 20,
        }}
      >
        <Metric label="MRR" value={`$${mrr.toFixed(2)}`} sub={`${txCount} giao dịch`} />
        <Metric label="Chi phí" value={`$${totalCost.toFixed(2)}`} sub="tháng này" />
        <Metric label="Lợi nhuận" value={`$${profit.toFixed(2)}`} sub="MRR − chi phí" />
      </section>

      {nextLocked && (
        <section style={cardStyle}>
          <h2 style={{ fontSize: 14, marginBottom: 10 }}>
            🔓 Unlock kế tiếp: <strong>{nextLocked.name}</strong>
          </h2>
          <ProgressBar current={mrr} target={Number(nextLocked.unlock_mrr_usd)} />
          <p style={{ fontSize: 12, color: "#666", marginTop: 8 }}>
            Cần thêm{" "}
            <strong>
              ${Math.max(0, Number(nextLocked.unlock_mrr_usd) - mrr).toFixed(2)}
            </strong>{" "}
            để unlock
          </p>
        </section>
      )}

      <section style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 14, marginBottom: 10, color: "#0a0" }}>
          🟢 Agent đang chạy ({activeAgents.length})
        </h2>
        {activeAgents.length === 0 && (
          <p style={{ fontSize: 13, color: "#999", padding: 12 }}>Chưa có agent nào</p>
        )}
        {activeAgents.map((a) => (
          <AgentRow key={a.slug} agent={a} />
        ))}
      </section>

      {lockedAgents.length > 0 && (
        <section style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 14, marginBottom: 10, color: "#888" }}>
            🔒 Agent chờ unlock ({lockedAgents.length})
          </h2>
          {lockedAgents.map((a) => (
            <AgentRow key={a.slug} agent={a} locked />
          ))}
        </section>
      )}

      <footer
        style={{
          fontSize: 11,
          color: "#999",
          textAlign: "center",
          marginTop: 32,
          paddingTop: 16,
          borderTop: "1px solid #eee",
        }}
      >
        <a href="/" style={{ color: "#666", textDecoration: "none" }}>
          ← Trang chủ
        </a>
        {" · "}
        <a
          href="https://github.com/nonghungnt01/ai-company-os"
          style={{ color: "#666", textDecoration: "none" }}
        >
          GitHub
        </a>
      </footer>
    </main>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        background: "#fafafa",
        border: "1px solid #eee",
        borderRadius: 10,
        padding: "12px 10px",
        textAlign: "center",
      }}
    >
      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>{value}</div>
      <div style={{ fontSize: 10, color: "#aaa" }}>{sub}</div>
    </div>
  );
}

function ProgressBar({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.max(0, (current / target) * 100));
  return (
    <div>
      <div
        style={{
          height: 8,
          background: "#eee",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: pct >= 100 ? "#0a0" : "#333",
            transition: "width 0.3s",
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginTop: 6,
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <span>${current.toFixed(2)}</span>
        <span>{pct.toFixed(0)}% → ${target.toFixed(2)}</span>
      </div>
    </div>
  );
}

function AgentRow({ agent, locked }: { agent: Agent; locked?: boolean }) {
  return (
    <div
      style={{
        ...cardStyle,
        opacity: locked ? 0.6 : 1,
        padding: "10px 14px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{agent.name}</div>
        <div
          style={{
            fontSize: 10,
            padding: "2px 8px",
            borderRadius: 10,
            background:
              agent.status === "RUNNING"
                ? "#d4f4dd"
                : agent.status === "IDLE"
                ? "#e6f0ff"
                : agent.status === "ERROR"
                ? "#fde"
                : "#eee",
            color:
              agent.status === "RUNNING"
                ? "#080"
                : agent.status === "IDLE"
                ? "#036"
                : agent.status === "ERROR"
                ? "#c00"
                : "#666",
          }}
        >
          {agent.status}
        </div>
      </div>
      {agent.description && (
        <div style={{ fontSize: 11, color: "#666", marginTop: 4 }}>
          {agent.description}
        </div>
      )}
      {locked && agent.unlock_mrr_usd > 0 && (
        <div style={{ fontSize: 10, color: "#999", marginTop: 4 }}>
          Cần MRR ${Number(agent.unlock_mrr_usd).toFixed(2)}
        </div>
      )}
    </div>
  );
}

const codeStyle: React.CSSProperties = {
  background: "#f0f0f0",
  padding: "2px 6px",
  borderRadius: 3,
  fontSize: 11,
  display: "inline-block",
  marginTop: 4,
};
