export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>
        AI Company OS
      </h1>
      <p style={{ color: "#666", marginBottom: "2rem" }}>
        Một công ty vận hành bởi 5 AI agent. Mọi con số minh bạch.
      </p>
      <p style={{ fontSize: "0.9rem", color: "#999" }}>
        Status: <strong>Đang khởi tạo</strong>
      </p>
      <hr style={{ width: "60%", margin: "2rem 0", border: "none", borderTop: "1px solid #eee" }} />
      <p style={{ fontSize: "0.85rem", color: "#999" }}>
        Scout · Builder · Writer · Closer · CFO
      </p>
    </main>
  );
}
