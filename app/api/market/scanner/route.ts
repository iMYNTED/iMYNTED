import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const tab = url.searchParams.get("tab") || "gainers";

    // ✅ Forward to the canonical route
    const forwardUrl = new URL(`/api/market/scanners`, url.origin);
    forwardUrl.searchParams.set("tab", tab);

    const res = await fetch(forwardUrl.toString(), { cache: "no-store" });
    const data = await res.json();

    return NextResponse.json(data, {
      status: res.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: "scanner forwarder failed", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
