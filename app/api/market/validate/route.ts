import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function normalizeSymbol(input: string) {
  return input.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
}

// Basic rules (mock validation):
// - 1 to 10 chars
// - Must start with a letter
// - Allowed: A-Z 0-9 . -
// - Reject obvious bad patterns
function isValidSymbol(sym: string) {
  if (!sym) return { ok: false, reason: "Empty symbol." };
  if (sym.length > 10) return { ok: false, reason: "Too long (max 10)." };
  if (!/^[A-Z]/.test(sym)) return { ok: false, reason: "Must start with a letter." };
  if (!/^[A-Z0-9.\-]+$/.test(sym)) return { ok: false, reason: "Invalid characters." };
  if (sym.includes("..") || sym.includes("--")) return { ok: false, reason: "Invalid pattern." };
  if (sym.endsWith(".") || sym.endsWith("-")) return { ok: false, reason: "Cannot end with '.' or '-'." };

  // Optional: block a few common non-symbol inputs
  const blocked = new Set(["HTTP", "HTTPS", "WWW", "COM", "ERROR", "NULL", "UNDEFINED"]);
  if (blocked.has(sym)) return { ok: false, reason: "Not a ticker symbol." };

  return { ok: true, reason: "" };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("symbol") ?? "";
  const normalized = normalizeSymbol(raw);

  const verdict = isValidSymbol(normalized);

  return NextResponse.json(
    {
      input: raw,
      normalized,
      valid: verdict.ok,
      reason: verdict.ok ? null : verdict.reason,
      // In the future, we’ll swap this to “real lookup provider”
      provider: "mock-rules",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
