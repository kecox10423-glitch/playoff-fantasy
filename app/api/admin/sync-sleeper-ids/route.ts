import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADMIN_USER_ID = "ae7339be-6503-45c1-91d0-eb09b9806a74";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLEEPER_ID_OVERRIDES: { [nameLower: string]: string } = {
  "lamar jackson": "4881",
  "devonta smith": "7525",
  "amon-ra st. brown": "6790",
  "dk metcalf": "5938",
  "aj brown": "6786",
  "tj hockenson": "5844",
  "jk dobbins": "6446",
};

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: NextRequest) {
  const { userId } = await req.json().catch(() => ({}));
  if (userId !== ADMIN_USER_ID) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Fetch all our players
  const { data: players, error } = await supabaseAdmin
    .from("players")
    .select("id, name, position")
    .eq("season", 2026);

  if (error || !players?.length) {
    return NextResponse.json({ error: "No players found" }, { status: 500 });
  }

  // Fetch Sleeper player list
  const sleeperRes = await fetch("https://api.sleeper.app/v1/players/nfl");
  const sleeperData = await sleeperRes.json();

  // Build name -> sleeper_id maps
  const nameToId: { [name: string]: string } = {};
  const normalizedToId: { [name: string]: string } = {};

  for (const [id, player] of Object.entries(sleeperData as any)) {
    const p = player as any;
    if (!p.first_name || !p.last_name) continue;

    const fullName = `${p.first_name} ${p.last_name}`.toLowerCase();
    nameToId[fullName] = id;

    const normalized = normalizeName(`${p.first_name} ${p.last_name}`);
    if (!normalizedToId[normalized]) normalizedToId[normalized] = id;
  }

  // DST sleeper IDs by abbreviation
  const dstMap: { [abbr: string]: string } = {
    BAL: "BAL", BUF: "BUF", LAC: "LAC", NE: "NE",
    KC: "KC", HOU: "HOU", DEN: "DEN",
    LAR: "LAR", SEA: "SEA", SF: "SF",
    DET: "DET", PHI: "PHI", GB: "GB", DAL: "DAL",
  };

  let matched = 0;
  let unmatched: string[] = [];

  for (const player of players) {
    let sleeperId: string | null = null;

    if (player.position === "DST") {
      // DST headshots use team abbreviation — skip for now
      continue;
    }

    const nameLower = player.name.toLowerCase();
    sleeperId = SLEEPER_ID_OVERRIDES[nameLower] || null;
    if (!sleeperId) sleeperId = nameToId[nameLower] || null;
    if (!sleeperId) sleeperId = normalizedToId[normalizeName(player.name)] || null;

    if (sleeperId) {
      await supabaseAdmin
        .from("players")
        .update({ sleeper_id: sleeperId })
        .eq("id", player.id);
      matched++;
    } else {
      unmatched.push(player.name);
    }
  }

  return NextResponse.json({
    success: true,
    matched,
    unmatched,
    total: players.length,
  });
}