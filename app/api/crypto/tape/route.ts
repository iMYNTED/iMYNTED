import { NextResponse } from "next/server";

function parseCryptoSymbol(input: string) {
  const raw = (input || "").toUpperCase().trim();
  const base = raw.includes("-") ? raw.split("-")[0] : raw;
  const pair = raw.includes("-") ? raw : `${base}-USD`;
  return { base, pair };
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const symbol = url.searchParams.get("symbol") || "BTC-USD";
    const { pair } = parseCryptoSymbol(symbol);

    const endpoint = `https://api.exchange.coinbase.com/products/${encodeURIComponent(
      pair
    )}/trades?limit=60`;

    const r = await fetch(endpoint, {
      cache: "no-store",
      headers: { "User-Agent": "msa/1.0" },
    });
    if (!r.ok) throw new Error(`Coinbase trades ${r.status}`);

    const rows = await r.json();

    const prints = Array.isArray(rows)
      ? rows.map((x: any) => ({
          ts: x.time || new Date().toISOString(),
          price: Number(x.price || 0),
          size: Number(x.size || 0),
          side: x.side === "buy" ? "B" : "S",
        }))
      : [];

    return NextResponse.json({ ok: true, data: prints });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "crypto tape failed", data: [] },
      { status: 500 }
    );
  }
}
