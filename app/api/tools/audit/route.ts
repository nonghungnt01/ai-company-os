import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url || !url.startsWith("http")) {
      return NextResponse.json({ error: "URL không hợp lệ. Phải bắt đầu bằng http:// hoặc https://" }, { status: 400 });
    }

    const startTime = Date.now();
    // Tải HTML của trang web khách
    const res = await fetch(url, {
      headers: { "User-Agent": "AI-Company-Auditor/1.0" },
      signal: AbortSignal.timeout(10000), // Timeout 10s
    });

    if (!res.ok) throw new Error(`Không thể truy cập website (HTTP ${res.status})`);
    
    const html = await res.text();
    const loadTime = Date.now() - startTime;
    const sizeKB = Math.round((html.length / 1024) * 10) / 10;

    // Phân tích HTML cơ bản (Không cần thư viện ngoài)
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
    const description = descMatch ? descMatch[1].trim() : null;

    const hasSchema = html.includes('application/ld+json');
    const hasOpenGraph = html.includes('property="og:');
    const hasH1 = /<h1[^>]*>/i.test(html);

    // Chấm điểm
    let score = 0;
    const issues = [];

    if (title && title.length >= 30 && title.length <= 60) score += 20;
    else issues.push("Thẻ Title thiếu hoặc không đúng độ dài chuẩn (30-60 ký tự).");

    if (description && description.length >= 120 && description.length <= 160) score += 20;
    else issues.push("Meta Description thiếu hoặc không đúng độ dài chuẩn (120-160 ký tự).");

    if (hasSchema) score += 20;
    else issues.push("Thiếu Schema.org JSON-LD (Google khó hiểu nội dung).");

    if (hasOpenGraph) score += 20;
    else issues.push("Thiếu thẻ Open Graph (Ảnh và tiêu đề hiển thị xấu khi share Facebook/Twitter).");

    if (hasH1) score += 20;
    else issues.push("Trang không có thẻ H1 (Lỗi nghiêm trọng về SEO).");

    return NextResponse.json({
      ok: true,
      url,
      load_time_ms: loadTime,
      size_kb: sizeKB,
      score,
      details: {
        title,
        description,
        has_schema: hasSchema,
        has_open_graph: hasOpenGraph,
        has_h1: hasH1,
      },
      issues,
    });

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}