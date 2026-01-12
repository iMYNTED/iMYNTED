import { NextResponse } from "next/server";

type NormalPrint = {
  t: string; // HH:MM:SS
  px: number;
  sz: number;
  side: "B" | "S" | "M";
};

function toNum(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function nowTime() {
  const d = new Date();
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pickSide(): "B" | "S" | "M" {
  const r = Math.random();
  if (r < 0.45) return "B";
  if (r < 0.9) return "S";
  return "M";
}

/**
 * Normalize unknown upstream print shapes into {t, px, sz, side}
 * Accepts common variants: time/t, price/px, size/sz, side.
 */
function normalizePrint(p: any): NormalPrint | null {
  const tRaw = p?.t ?? p?.time ?? p?.timestamp ?? "";
  const t =
    typeof tRaw === "string" && tRaw.trim()
      ? tRaw.trim().slice(0, 8) // keep HH:MM:SS if present
      : nowTime();

  const px = toNum(p?.px ?? p?.price ?? p?.last ?? p?.p);
  const sz = toNum(p?.sz ?? p?.size ?? p?.qty ?? p?.q);

  if (px === null || sz === null) return null;

  const sideRaw = String(p?.side ?? p?.s ?? "M").toUpperCase();
  const side: "B" | "S" | "M" =
    sideRaw === "B" || sideRaw === "BUY"
      ? "B"
      : sideRaw === "S" || sideRaw === "SELL"
      ? "S"
      : "M";

  return { t, px, sz, side };
}

/**
 * If you later wire to a real provider, convert their output to prints,
 * but ALWAYS return the same response shape.
 */
function genMockTape(symbol: string): { prints: NormalPrint[]; source: string } {
  // Create a “moving” tape: random prints around a base
  const base = symbol === "AAPL" ? 258 : symbol === "TSLA" ? 320 : 100;

  const prints: NormalPrint[] = Array.from({ length: 60 }).map(() => {
    const px = Number((base + rand(-0.6, 0.6)).toFixed(2));
    const sz = Math.floor(rand(10, 2500));
    return { t: nowTime(), px, sz, side: pickSide() };
  });

  return { prints, source: "mock" };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") || "AAPL").toUpperCase();

  // If you have an upstream fetch in your current tape route, keep it here.
  // For now, we normalize if it exists; otherwise we return mock.

  try {
    // 🔁 If you already fetch upstream, drop it here and normalize:
    // const upstream = await fetch("...", { headers: {...} });
    // const raw = await upstream.json();
    // const rawPrints = raw.prints ?? raw.trades ?? raw.data ?? [];
    // const prints = (rawPrints as any[]).map(normalizePrint).filter(Boolean) as NormalPrint[];

    // ✅ default mock (stable + never breaks UI)
    const { prints, source } = genMockTape(symbol);

    return NextResponse.json({
      symbol,
      prints,
      source,
      ts: new Date().toISOString(),
    });
  } catch (e: any) {
    // Even on error, return a safe payload so UI never crashes
    const { prints } = genMockTape(symbol);

    return NextResponse.json(
      {
        symbol,
        prints,
        source: "mock",
        ts: new Date().toISOString(),
        error: e?.message ?? "tape route error",
      },
      { status: 200 }
    );
  }
}
