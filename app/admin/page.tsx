"use client";

import { useState, useEffect } from "react";

type Task = {
  id: string;
  agent_slug: string;
  status: string;
  assigned_by: string;
  admin_instruction: string | null;
  output: any;
  error: string | null;
  started_at: string;
  finished_at: string | null;
};

type Msg = {
  id: string;
  from_role: string;
  to_role: string;
  content: string;
  status: string;
  created_at: string;
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState("");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secret.length > 10) {
      sessionStorage.setItem("admin_secret", secret);
      setIsLoggedIn(true);
    } else {
      alert("Secret không hợp lệ");
    }
  };

  const sendCommand = async (agentSlug: string) => {
    setStatus(`Đang giao việc cho ${agentSlug}...`);
    try {
      const res = await fetch("/api/admin/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionStorage.getItem("admin_secret")}`,
        },
        body: JSON.stringify({ agentSlug, instruction: command }),
      });
      const data = await res.json();
      if (!data.ok) {
        setStatus(`❌ Lỗi: ${data.error}`);
        return;
      }

      setCommand("");
      setStatus(`⚙ Đã giao việc. Đang kích hoạt ${agentSlug}...`);

      // Browser tự gọi agent — KHÔNG bị Vercel kill
      const secret = sessionStorage.getItem("admin_secret");
      const agentRes = await fetch(`/api/agents/${agentSlug}?secret=${secret}`);
      const agentData = await agentRes.json();

      if (agentData.ok) {
        setStatus(`✅ ${agentSlug} xong rồi! (${agentData.pain_points_count ?? 0} kết quả)`);
      } else {
        setStatus(`⚠ ${agentSlug} lỗi: ${agentData.error}`);
      }
      setTimeout(fetchLogs, 1000);
    } catch (err: any) {
      setStatus(`❌ Lỗi mạng: ${err.message}`);
    }
  };

  const fetchLogs = async () => {
    const s = sessionStorage.getItem("admin_secret");
    if (!s) return;
    try {
      const res = await fetch("/api/admin/logs", {
        headers: { Authorization: `Bearer ${s}` },
      });
      const data = await res.json();
      setTasks(data.tasks ?? []);
      setMessages(data.messages ?? []);
    } catch {}
  };

  useEffect(() => {
    if (!isLoggedIn) return;
    fetchLogs();
    const timer = setInterval(fetchLogs, 5000);
    return () => clearInterval(timer);
  }, [isLoggedIn]);

  if (!isLoggedIn) {
    return (
      <div style={{ maxWidth: 400, margin: "100px auto", padding: 20 }}>
        <h1 style={{ fontSize: 20, marginBottom: 20 }}>🔒 Admin Login</h1>
        <form onSubmit={handleLogin}>
          <input
            type="password"
            placeholder="Nhập CRON_SECRET của bạn..."
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            style={{ width: "100%", padding: 10, marginBottom: 10, border: "1px solid #ccc" }}
          />
          <button type="submit" style={{ width: "100%", padding: 10, background: "#000", color: "#fff" }}>
            Vào Trung Tâm Chỉ Huy
          </button>
        </form>
      </div>
    );
  }

  const agents = [
    { slug: "scout", name: "Scout" },
    { slug: "builder", name: "Builder" },
    { slug: "writer", name: "Writer" },
    { slug: "closer", name: "Closer" },
    { slug: "cfo", name: "CFO" },
  ];

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>🎯 Trung Tâm Chỉ Huy</h1>

      <div style={{ marginBottom: 24, padding: 15, background: "#f5f5f5", borderRadius: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Mệnh lệnh mới:</label>
        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="VD: Tìm 5 pain points về ví điện tử Crypto"
          style={{ width: "100%", height: 80, padding: 10, marginTop: 8, marginBottom: 10, fontFamily: "inherit" }}
        />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {agents.map((a) => (
            <button
              key={a.slug}
              onClick={() => sendCommand(a.slug)}
              disabled={!command}
              style={{ padding: "8px 12px", background: "#0070f3", color: "#fff", borderRadius: 5, border: "none", fontSize: 12 }}
            >
              Giao {a.name}
            </button>
          ))}
        </div>
        {status && <p style={{ fontSize: 13, marginTop: 10, color: "#080" }}>{status}</p>}
      </div>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>📋 Công việc gần đây</h2>
        {tasks.length === 0 && <p style={{ fontSize: 13, color: "#999" }}>Chưa có task nào</p>}
        
        {tasks.map((t) => (
          <details
            key={t.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              marginBottom: 10,
              background: "#fff",
              overflow: "hidden",
            }}
          >
            {/* Phần tóm tắt (luôn hiện) */}
            <summary
              style={{
                padding: "12px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#fafafa",
              }}
            >
              <div>
                <strong style={{ fontSize: 13 }}>{t.agent_slug.toUpperCase()}</strong>
                {t.assigned_by === "admin" && <span style={{ fontSize: 10, color: "#c60", marginLeft: 6 }}>👤 Admin giao</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 10, color: "#aaa" }}>
                  {new Date(t.started_at).toLocaleTimeString("vi-VN")}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    borderRadius: 10,
                    fontWeight: 600,
                    background:
                      t.status === "SUCCESS" ? "#d4f4dd" :
                      t.status === "FAILED" ? "#fde" :
                      t.status === "RUNNING" ? "#e6f0ff" : "#eee",
                    color:
                      t.status === "SUCCESS" ? "#080" :
                      t.status === "FAILED" ? "#c00" :
                      t.status === "RUNNING" ? "#036" : "#666",
                  }}
                >
                  {t.status}
                </span>
              </div>
            </summary>

            {/* Phần chi tiết (khi bấm vào sẽ xổ xuống) */}
            <div style={{ padding: 12, borderTop: "1px solid #eee", fontSize: 12 }}>
              {t.admin_instruction && (
                <div style={{ marginBottom: 10, padding: 8, background: "#fff8e6", borderRadius: 4, borderLeft: "3px solid #f5a623" }}>
                  <strong>Mệnh lệnh của bạn:</strong> {t.admin_instruction}
                </div>
              )}

              {t.error && (
                <div style={{ color: "#c00", marginBottom: 10, padding: 8, background: "#fee", borderRadius: 4 }}>
                  ⚠ <strong>Lỗi:</strong> {t.error}
                </div>
              )}

              {t.output?.pain_points && t.output.pain_points.length > 0 && (
                <div>
                  <strong style={{ color: "#333", display: "block", marginBottom: 6 }}>🧠 Suy nghĩ / Kết quả của AI:</strong>
                  {t.output.pain_points.map((p: any, idx: number) => (
                    <div key={idx} style={{ marginBottom: 8, paddingLeft: 10, borderLeft: "2px solid #0070f3" }}>
                      <div style={{ fontWeight: 600, color: "#111" }}>{idx + 1}. {p.title}</div>
                      <div style={{ color: "#666", marginTop: 2 }}>
                        Phân loại: <span style={{ background: "#eee", padding: "1px 4px", borderRadius: 3 }}>{p.category}</span>
                        {" • "}Điểm: {p.score}/100
                      </div>
                      {p.evidence_url && (
                        <a href={p.evidence_url} target="_blank" rel="noreferrer" style={{ color: "#0070f3", textDecoration: "none", display: "block", marginTop: 4, fontSize: 11, wordBreak: "break-all" }}>
                          🔗 Nguồn: {p.evidence_url}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
              
              {(!t.output?.pain_points || t.output.pain_points.length === 0) && t.status === "SUCCESS" && (
                <div style={{ color: "#888", fontStyle: "italic" }}>AI không tìm thấy pain point nào phù hợp.</div>
              )}
            </div>
          </details>
        ))}
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 10 }}>💬 Luồng giao tiếp</h2>
        {messages.length === 0 && <p style={{ fontSize: 13, color: "#999" }}>Chưa có tin nhắn</p>}
        {messages.map((m) => (
          <div
            key={m.id}
            style={{ borderLeft: "3px solid #0070f3", paddingLeft: 10, marginBottom: 8, fontSize: 12 }}
          >
            <div style={{ color: "#666" }}>
              <strong>{m.from_role}</strong> → <strong>{m.to_role}</strong>
              <span style={{ color: "#aaa", marginLeft: 6, fontSize: 10 }}>
                {new Date(m.created_at).toLocaleTimeString("vi-VN")}
              </span>
            </div>
            <div style={{ color: "#333", marginTop: 2 }}>{m.content}</div>
          </div>
        ))}
      </section>
    </div>
  );
}