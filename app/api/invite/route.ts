import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { code } = await req.json();
  const valid = (process.env.INVITE_CODES || "").split(",").map(c => c.trim().toUpperCase());
  if (!code || !valid.includes(code.trim().toUpperCase())) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
