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
      if (data.ok) {
        setStatus(`✅ Đã giao việc cho ${agentSlug}!`);
        setCommand("");
        setTimeout(fetchLogs, 2000);
      } else {
        setStatus(`❌ Lỗi: ${data.error}`);
      }
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
          <div
            key={t.id}
            style={{ border: "1px solid #eee", borderRadius: 6, padding: 10, marginBottom: 8, fontSize: 13 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <strong>{t.agent_slug.toUpperCase()}</strong>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 6px",
                  borderRadius: 4,
                  background: t.status === "SUCCESS" ? "#d4f4dd" : t.status === "FAILED" ? "#fde" : t.status === "RUNNING" ? "#e6f0ff" : "#eee",
                }}
              >
                {t.status}
              </span>
            </div>
            {t.assigned_by === "admin" && (
              <div style={{ color: "#c60", fontSize: 11, marginBottom: 4 }}>👤 Admin: {t.admin_instruction}</div>
            )}
            {t.output?.pain_points && (
              <div style={{ color: "#666", fontSize: 11 }}>
                → {t.output.pain_points.length} pain points
              </div>
            )}
            {t.error && <div style={{ color: "#c00", fontSize: 11 }}>⚠ {t.error}</div>}
            <div style={{ color: "#aaa", fontSize: 10, marginTop: 4 }}>
              {new Date(t.started_at).toLocaleString("vi-VN")}
            </div>
          </div>
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