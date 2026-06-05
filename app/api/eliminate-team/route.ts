import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const { team_abbreviations, round } = await request.json();

  for (const abbr of team_abbreviations) {
    // Mark team as eliminated
    const { data: team, error: teamError } = await supabase
      .from("nfl_teams")
      .update({ is_eliminated: true, eliminated_round: round })
      .eq("abbreviation", abbr)
      .eq("season", 2026)
      .select()
      .single();

    if (teamError) {
      return NextResponse.json({ error: `Team ${abbr} not found` });
    }

    // Deactivate all players on that team
    await supabase
      .from("players")
      .update({ is_active: false })
      .eq("nfl_team_id", team.id);
  }

  return NextResponse.json({
    message: `Eliminated ${team_abbreviations.join(", ")} in ${round}`
  });
}