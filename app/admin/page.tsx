"use client";

import { useState } from "react";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [command, setCommand] = useState("");
  const [status, setStatus] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (secret.length > 10) {
      // Tạm thời lưu secret vào sessionStorage để gọi API
      sessionStorage.setItem("admin_secret", secret);
      setIsLoggedIn(true);
    } else {
      alert("Secret không hợp lệ (phải dài > 10 ký tự)");
    }
  };

  const sendCommand = async (agentSlug: string) => {
    setStatus(`Đang gửi lệnh cho ${agentSlug}...`);
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
      } else {
        setStatus(`❌ Lỗi: ${data.error}`);
      }
    } catch (err: any) {
      setStatus(`❌ Lỗi mạng: ${err.message}`);
    }
  };

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
    { slug: "scout", name: "Scout (Trinh sát)" },
    { slug: "builder", name: "Builder (Xây dựng)" },
    { slug: "writer", name: "Writer (Biên tập)" },
    { slug: "closer", name: "Closer (Bán hàng)" },
    { slug: "cfo", name: "CFO (Tài chính)" },
  ];

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: 20 }}>
      <h1 style={{ fontSize: 22, marginBottom: 20 }}>🎯 Trung Tâm Chỉ Huy</h1>
      
      <div style={{ marginBottom: 20, padding: 15, background: "#f5f5f5", borderRadius: 8 }}>
        <label style={{ fontSize: 14, fontWeight: 600 }}>Mệnh lệnh mới:</label>
        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="VD: Tìm 5 pain points về ví điện tử Crypto trên HackerNews"
          style={{ width: "100%", height: 80, padding: 10, marginTop: 8, marginBottom: 10 }}
        />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {agents.map((a) => (
            <button
              key={a.slug}
              onClick={() => sendCommand(a.slug)}
              disabled={!command}
              style={{ padding: "8px 12px", background: "#0070f3", color: "#fff", borderRadius: 5, border: "none", fontSize: 12 }}
            >
              Giao cho {a.name.split(" ")[0]}
            </button>
          ))}
        </div>
        {status && <p style={{ fontSize: 13, marginTop: 10, color: "green" }}>{status}</p>}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>Nhật ký hoạt động</h2>
      <div style={{ border: "1px solid #eee", borderRadius: 8, padding: 10, fontSize: 13, color: "#666" }}>
        (Phần này sẽ hiển thị real-time log của 5 agent - code ở bước sau)
      </div>
    </div>
  );
}