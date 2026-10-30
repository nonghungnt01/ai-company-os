import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HN_API =
  "https://hn.algolia.com/api/v1/search_by_date?tags=show_hn&hitsPerPage=10";
const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";
const MODEL = "openai/gpt-oss-20b";

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const groqKey = process.env.GROQ_API_KEY;
  if (!sbUrl || !sbKey || !groqKey) {
    return NextResponse.json({ error: "missing_env" }, { status: 500 });
  }

  const supabase = createClient(sbUrl, sbKey, {
    auth: { persistSession: false },
  });

  const { data: task, error: taskErr } = await supabase
    .from("tasks")
    .insert({
      agent_slug: "scout",
      status: "RUNNING",
      model: MODEL,
      is_mock: false,
      input: { source: "hn_show_hn", limit: 10 },
    })
    .select()
    .single();

  if (taskErr || !task) {
    return NextResponse.json(
      { error: "cannot_create_task", detail: taskErr?.message },
      { status: 500 }
    );
  }

  const started = Date.now();

  try {
    const hnRes = await fetch(HN_API, { cache: "no-store" });
    if (!hnRes.ok) throw new Error(`HN ${hnRes.status}`);
    const hnData = await hnRes.json();
    const items = (hnData.hits ?? []).slice(0, 8).map((h: any) => ({
      title: h.title,
      url: h.url,
      points: h.points,
      comments: h.num_comments,
    }));

    const groqRes = await fetch(GROQ_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content:
              'You are a market research agent. From these Show HN launches, extract 3 pain points related to website SEO, technical performance, or conversion. Respond strictly with JSON: {"pain_points":[{"title":"...","evidence_url":"...","category":"seo|perf|conversion","score":0}]}',
          },
          { role: "user", content: JSON.stringify(items) },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    if (!groqRes.ok) {
      const errText = (await groqRes.text()).slice(0, 200);
      throw new Error(`Groq ${groqRes.status}: ${errText}`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);
    const painPoints = Array.isArray(parsed.pain_points)
      ? parsed.pain_points.slice(0, 3)
      : [];

    await supabase
      .from("tasks")
      .update({
        status: "SUCCESS",
        output: { pain_points: painPoints, raw_items: items },
        cost_usd: 0,
        finished_at: new Date().toISOString(),
      })
      .eq("id", task.id);

    await supabase
      .from("agents")
      .update({ status: "IDLE", last_run_at: new Date().toISOString() })
      .eq("slug", "scout");

    return NextResponse.json({
      ok: true,
      task_id: task.id,
      pain_points_count: painPoints.length,
      duration_ms: Date.now() - started,
    });
  } catch (e: any) {
    const err = e?.message ?? String(e);
    await supabase
      .from("tasks")
      .update({
        status: "FAILED",
        error: err.slice(0, 500),
        finished_at: new Date().toISOString(),
      })
      .eq("id", task.id);
    await supabase
      .from("agents")
      .update({ status: "ERROR" })
      .eq("slug", "scout");
    return NextResponse.json(
      { ok: false, task_id: task.id, error: err },
      { status: 500 }
    );
  }
}
