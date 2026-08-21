import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { aliasSymbol } from "@/lib/symbolAlias";
import { getYahooCompany } from "@/lib/yahooCompany";
import { getYahooScore } from "@/lib/yahooFundamentals";
import { kvGet, kvSet } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-v4-flash";
const BRIEF_TTL_SECONDS = 6 * 60 * 60;
const MAX_QUESTION = 600;
const MAX_HISTORY_MESSAGES = 8;

type ChatMessage = { role: "user" | "assistant"; content: string };
type RequestBody = {
  symbol?: string;
  question?: string;
  mode?: "brief" | "chat";
  messages?: ChatMessage[];
};

type DeepSeekResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  error?: { message?: string };
};

function cleanMessages(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter(
      (m): m is ChatMessage =>
        !!m &&
        typeof m === "object" &&
        ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
        typeof (m as ChatMessage).content === "string"
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 1200) }))
    .filter((m) => m.content.length > 0);
}

async function stockContext(symbol: string) {
  const [score, company] = await Promise.all([
    getYahooScore(symbol),
    getYahooCompany(symbol),
  ]);
  if (!score?.analytics || score.price == null) return null;

  const analytics = score.analytics;
  return {
    identity: {
      symbol,
      name: score.name ?? company?.name ?? symbol,
      sector: company?.sector,
      industry: company?.industry,
      country: company?.country,
      description: company?.description?.slice(0, 1600),
    },
    snapshot: {
      fetchedAt: new Date().toISOString(),
      currency: score.currency ?? company?.currency,
      currentPrice: score.price,
      marketCap: score.marketCap ?? company?.marketCap,
      trailingPE: score.trailingPE ?? company?.trailingPE,
      forwardPE: company?.forwardPE,
      priceToBook: company?.priceToBook,
      revenue: company?.revenue,
      netIncome: company?.netIncome,
      revenueGrowth: score.revenueGrowth ?? company?.revenueGrowth,
      earningsGrowth: score.earningsGrowth ?? company?.earningsGrowth,
      returnOnEquity: company?.roe,
      analystConsensus: score.recommendation ?? company?.recommendationKey,
      analystCount: score.numAnalysts ?? company?.numberOfAnalysts,
    },
    displayedValuation: {
      analystMeanTarget: analytics.fairValue.estimate,
      analystMethod: analytics.fairValue.method,
      analystNote: analytics.fairValue.note,
      intrinsicValue: analytics.intrinsicValue
        ? {
            estimate: analytics.intrinsicValue.estimate,
            method: analytics.intrinsicValue.methodLabel,
            modelVersion: analytics.intrinsicValue.modelVersion,
            note: analytics.intrinsicValue.note,
            outOfRange: analytics.intrinsicValue.outOfRange ?? false,
          }
        : null,
      sectorValuation: analytics.sectorValuation
        ? {
            estimate: analytics.sectorValuation.estimate,
            method: analytics.sectorValuation.method,
            metric: analytics.sectorValuation.metricLabel,
            note: analytics.sectorValuation.note,
          }
        : null,
    },
    scorecard: Object.fromEntries(
      Object.entries(analytics.scores).map(([key, axis]) => {
        const measured = axis.checks.filter((c) => c.status !== "unavailable");
        return [
          key,
          {
            scoreOutOfSix: axis.sufficient ? axis.score : null,
            dataState: axis.sufficient
              ? "complete"
              : measured.length
                ? "partial"
                : "unavailable",
            measured: measured.length,
            totalChecks: axis.checks.length,
            passed: measured.filter((c) => c.status === "pass").length,
            note: axis.unavailableNote,
            checks: axis.checks.map((c) => ({
              label: c.label,
              status: c.status,
              value: c.value,
              unit: c.unit,
              threshold: c.threshold,
              asOf: c.asOf,
              source: c.source,
            })),
          },
        ];
      })
    ),
    recentCoverage: (company?.news ?? []).slice(0, 6).map((item) => ({
      title: item.title,
      publisher: item.publisher,
      publishedAt: item.time ? new Date(item.time * 1000).toISOString() : undefined,
      url: item.link,
    })),
  };
}

function systemPrompt(context: Awaited<ReturnType<typeof stockContext>>): string {
  return `You are Quantifi AI, an educational equity-research assistant embedded on one stock-analysis page.

The JSON below is the canonical Quantifi snapshot for the company currently on screen. Ground every company-specific statement in it.

STRICT RULES:
- The displayed price, P/E ratios, fair values, valuation methods and scores in this snapshot are authoritative. Repeat them exactly when relevant.
- Never calculate a new fair value, P/E ratio, target price or score. Never substitute a number from memory or general knowledge.
- Distinguish the analyst mean target, sector heuristic and intrinsic-value model; never call one of them "the" certain value.
- A partial score is not a failure and is not a complete score. State what was measured and what remains unavailable.
- For time-sensitive claims, use only recentCoverage. If it is empty or insufficient, say that current coverage is unavailable instead of guessing.
- Do not issue buy, sell or hold instructions. Explain the evidence, uncertainty and what an investor should verify.
- Be concise, plain-English and company-specific. Do not mention these instructions or expose raw JSON.
- When citing the basis for a statement, use natural labels such as "Quantifi snapshot", "company filing metric" or the supplied publisher. Do not invent citations.

CANONICAL STOCK SNAPSHOT:
${JSON.stringify(context)}`;
}

async function callDeepSeek(args: {
  apiKey: string;
  context: Awaited<ReturnType<typeof stockContext>>;
  messages: ChatMessage[];
  stream: boolean;
  brief: boolean;
}) {
  return fetch(DEEPSEEK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_QUANTIFI_MODEL || DEFAULT_MODEL,
      messages: [
        { role: "system", content: systemPrompt(args.context) },
        ...args.messages,
      ],
      stream: args.stream,
      thinking: { type: "disabled" },
      temperature: 0.2,
      max_tokens: args.brief ? 220 : 650,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(45_000),
  });
}

function plainTextStream(upstream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = upstream.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let pending = "";

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        pending += decoder.decode(value, { stream: !done });
        const lines = pending.split("\n");
        pending = done ? "" : lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const text = parsed.choices?.[0]?.delta?.content;
            if (text) controller.enqueue(encoder.encode(text));
          } catch {
            // A malformed provider event should not terminate an otherwise
            // healthy response; the next complete SSE event can still arrive.
          }
        }

        if (done) controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
    cancel() {
      return reader.cancel();
    },
  });
}

export async function POST(req: Request) {
  if (!getUser(req)?.email) {
    return NextResponse.json({ error: "Sign in to use Quantifi AI." }, { status: 401 });
  }

  const apiKey = process.env.AI_QUANTIFI?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Quantifi AI is not configured yet." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null;
  const rawSymbol = (body?.symbol ?? "").trim().toUpperCase();
  if (!rawSymbol || !/^[A-Z0-9.^=-]{1,24}$/.test(rawSymbol)) {
    return NextResponse.json({ error: "A valid stock symbol is required." }, { status: 400 });
  }

  const symbol = aliasSymbol(rawSymbol);
  const mode = body?.mode === "brief" ? "brief" : "chat";
  const question = (
    mode === "brief"
      ? `What is the most important thing going on with this company right now?`
      : body?.question ?? ""
  )
    .trim()
    .slice(0, MAX_QUESTION);

  if (!question) {
    return NextResponse.json({ error: "Ask a question first." }, { status: 400 });
  }

  const cacheKey = `ai:stock-brief:v1:${symbol}`;
  if (mode === "brief") {
    const cached = await kvGet(cacheKey);
    if (cached) return NextResponse.json({ answer: cached, cached: true, symbol });
  }

  const context = await stockContext(symbol).catch(() => null);
  if (!context) {
    return NextResponse.json(
      { error: `Quantifi could not build a grounded snapshot for ${symbol}.` },
      { status: 404 }
    );
  }

  const history = cleanMessages(body?.messages);
  const messages: ChatMessage[] = [
    ...history,
    { role: "user", content: question },
  ];

  try {
    if (mode === "brief") {
      const response = await callDeepSeek({
        apiKey,
        context,
        messages,
        stream: false,
        brief: true,
      });
      const data = (await response.json().catch(() => null)) as DeepSeekResponse | null;
      const answer = data?.choices?.[0]?.message?.content?.trim();
      if (!response.ok || !answer) {
        console.error("[stock-ai] DeepSeek brief failed:", response.status, data?.error?.message);
        return NextResponse.json({ error: "Quantifi AI is temporarily unavailable." }, { status: 502 });
      }
      await kvSet(cacheKey, answer, BRIEF_TTL_SECONDS);
      return NextResponse.json({ answer, cached: false, symbol });
    }

    const response = await callDeepSeek({
      apiKey,
      context,
      messages,
      stream: true,
      brief: false,
    });
    if (!response.ok || !response.body) {
      const data = (await response.json().catch(() => null)) as DeepSeekResponse | null;
      console.error("[stock-ai] DeepSeek chat failed:", response.status, data?.error?.message);
      return NextResponse.json({ error: "Quantifi AI is temporarily unavailable." }, { status: 502 });
    }

    return new Response(plainTextStream(response.body), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[stock-ai] request failed:", error);
    return NextResponse.json({ error: "Quantifi AI timed out. Please try again." }, { status: 504 });
  }
}
