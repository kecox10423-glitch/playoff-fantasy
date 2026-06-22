import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const { leagueId } = await req.json();
  if (!leagueId) return NextResponse.json({ error: "Missing leagueId" }, { status: 400 });

  const { data: members, error } = await supabaseAdmin
    .from("league_members")
    .select("id, user_id")
    .eq("league_id", leagueId);

  if (error || !members?.length) return NextResponse.json({ error: "No members found" }, { status: 500 });

  const shuffled = [...members].sort(() => Math.random() - 0.5);

  for (let i = 0; i < shuffled.length; i++) {
    await supabaseAdmin
      .from("league_members")
      .update({ draft_position: i + 1 })
      .eq("id", shuffled[i].id);
  }

  return NextResponse.json({ success: true, order: shuffled.map(m => m.user_id) });
}