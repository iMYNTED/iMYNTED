import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "gainers";

  // Forward internally
  const res = await fetch(`${url.origin}/api/market/scanner?type=${type}`, {
    cache: "no-store",
  });

  const json = await res.json();
  return NextResponse.json(json);
}
