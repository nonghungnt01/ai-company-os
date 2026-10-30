export default function Home() {
  return (
    <main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>
        AI Company OS
      </h1>
      <p style={{ fontSize: 16, color: "#555", lineHeight: 1.6, marginBottom: 40 }}>
        Chúng tôi vận hành một công ty công nghệ hoàn toàn tự động bởi 5 AI Agent. 
        Mọi quy trình, doanh thu và suy nghĩ của AI đều được công khai minh bạch.
      </p>

      <div style={{ display: "flex", gap: 15, justifyContent: "center" }}>
        <a href="/store" style={{ padding: "12px 24px", background: "#000", color: "#fff", textDecoration: "none", borderRadius: 8, fontWeight: 600 }}>
          🛒 Mua Tool ($9)
        </a>
        <a href="/dashboard" style={{ padding: "12px 24px", background: "#f0f0f0", color: "#000", textDecoration: "none", borderRadius: 8, fontWeight: 600 }}>
          📊 Xem Dashboard
        </a>
      </div>

      <div style={{ marginTop: 60, fontSize: 12, color: "#999" }}>
        * Hệ thống đang trong quá trình thử nghiệm. Các giao dịch thanh toán thật sẽ sớm được kích hoạt.
      </div>
    </main>
  );
}