import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { leagueId, requestingUserId, targetUserId } = await req.json();

    if (!leagueId || !requestingUserId || !targetUserId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify requester is commissioner or admin
    const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";
    const { data: league } = await supabaseAdmin
      .from("leagues")
      .select("commissioner_user_id, draft_status")
      .eq("id", leagueId)
      .single();

    if (!league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    const isCommissioner = league.commissioner_user_id === requestingUserId;
    const isAdmin = requestingUserId === ADMIN_USER_ID;

    if (!isCommissioner && !isAdmin) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Cannot remove commissioner themselves
    if (targetUserId === league.commissioner_user_id) {
      return NextResponse.json({ error: "Cannot remove the commissioner" }, { status: 400 });
    }

    // Remove member
    const { error } = await supabaseAdmin
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", targetUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}