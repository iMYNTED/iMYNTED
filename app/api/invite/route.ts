import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function validCode(code: string) {
  const valid = (process.env.INVITE_CODES || "").split(",").map(c => c.trim().toUpperCase());
  return valid.includes(code.trim().toUpperCase());
}

// POST /api/invite — validate code, optionally stamp user
export async function POST(req: NextRequest) {
  const { code, email } = await req.json();

  if (!code || !validCode(code)) {
    return NextResponse.json({ error: "Invalid invite code." }, { status: 403 });
  }

  // If email provided, stamp invited: true on the user via service role
  if (email && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      // Find user by email
      const { data: users } = await admin.auth.admin.listUsers();
      const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (user) {
        await admin.auth.admin.updateUserById(user.id, {
          user_metadata: { ...user.user_metadata, invited: true },
        });
      }
    } catch {
      // Non-fatal — user will be stamped at callback if they already exist
    }
  }

  return NextResponse.json({ ok: true });
}
