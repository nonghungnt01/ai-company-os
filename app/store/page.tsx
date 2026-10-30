"use client";

import { useState } from "react";

export default function StorePage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState("");

  const runAudit = async () => {
    if (!url) return;
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await fetch("/api/tools/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.ok) {
        setReport(data);
      } else {
        setError(data.error);
      }
    } catch (err: any) {
      setError("Lỗi kết nối mạng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>AI Website Auditor</h1>
        <p style={{ color: "#666", fontSize: 14 }}>Phát hiện ngay 5 lỗi SEO nghiêm trọng đang làm rớt traffic của bạn.</p>
      </div>

      <div style={{ background: "#f9f9f9", padding: 20, borderRadius: 12, border: "1px solid #eee" }}>
        <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 8 }}>Nhập URL Website của bạn:</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="url"
            placeholder="https://example.com"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ flex: 1, padding: "10px 12px", border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
          />
          <button
            onClick={runAudit}
            disabled={loading}
            style={{ padding: "10px 20px", background: "#000", color: "#fff", borderRadius: 6, border: "none", fontWeight: 600, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Đang quét..." : "Quét Ngay ($9)"}
          </button>
        </div>
        <p style={{ fontSize: 11, color: "#999", marginTop: 10, textAlign: "center" }}>
          (Đây là bản Demo miễn phí. Khi kết nối thanh toán, nút này sẽ yêu cầu trả $9 trước khi chạy)
        </p>
      </div>

      {error && (
        <div style={{ marginTop: 20, padding: 15, background: "#fee", color: "#c00", borderRadius: 8, fontSize: 14 }}>
          ⚠ {error}
        </div>
      )}

      {report && (
        <div style={{ marginTop: 30 }}>
          <h2 style={{ fontSize: 18, marginBottom: 15 }}>📊 Báo cáo phân tích:</h2>
          
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <div style={{ flex: 1, background: report.score >= 80 ? "#e6ffed" : "#fff3cd", padding: 15, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Điểm SEO</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: report.score >= 80 ? "#080" : "#c60" }}>{report.score}/100</div>
            </div>
            <div style={{ flex: 1, background: "#f0f0f0", padding: 15, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Tốc độ tải</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{report.load_time_ms}ms</div>
            </div>
            <div style={{ flex: 1, background: "#f0f0f0", padding: 15, borderRadius: 8, textAlign: "center" }}>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>Kích thước</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{report.size_kb} KB</div>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 15, marginBottom: 15 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, borderBottom: "1px solid #eee", paddingBottom: 5 }}>Thông tin cơ bản</h3>
            <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Title:</strong> {report.details.title || "❌ Thiếu"}</div>
            <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Description:</strong> {report.details.description || "❌ Thiếu"}</div>
            <div style={{ fontSize: 13 }}><strong>Open Graph:</strong> {report.details.has_open_graph ? "✅ Có" : "❌ Thiếu"}</div>
            <div style={{ fontSize: 13 }}><strong>Schema JSON-LD:</strong> {report.details.has_schema ? "✅ Có" : "❌ Thiếu"}</div>
          </div>

          <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 15 }}>
            <h3 style={{ fontSize: 14, marginBottom: 10, borderBottom: "1px solid #eee", paddingBottom: 5, color: "#c00" }}>Các vấn đề cần khắc phục</h3>
            {report.issues.length === 0 ? (
              <div style={{ fontSize: 13, color: "#080" }}>Tuyệt vời! Không phát hiện lỗi nào.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: "#333" }}>
                {report.issues.map((issue: string, i: number) => <li key={i} style={{ marginBottom: 6 }}>{issue}</li>)}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}