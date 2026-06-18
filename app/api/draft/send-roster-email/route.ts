// app/api/draft/send-roster-email/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const POSITION_ORDER = ["QB", "RB", "WR", "TE", "K", "DST"];

function positionColor(position: string): string {
  switch (position) {
    case "QB":  return "#991b1b";
    case "RB":  return "#1e3a5f";
    case "WR":  return "#78350f";
    case "TE":  return "#4c1d95";
    case "K":   return "#374151";
    case "DST": return "#7c2d12";
    default:    return "#374151";
  }
}

function buildRosterEmailHtml(
  teamName: string,
  leagueName: string,
  leagueUrl: string,
  roster: { name: string; position: string; team: string; seed: number; round: number; pick: number }[]
): string {
  const positionGroups: { [pos: string]: typeof roster } = {};
  for (const pos of POSITION_ORDER) {
    positionGroups[pos] = roster.filter(p => p.position === pos);
  }

  const playerRows = POSITION_ORDER.flatMap(pos =>
    positionGroups[pos].map(player => `
      <tr>
        <td style="padding:10px 16px; border-bottom:1px solid #1f2937; vertical-align:middle;">
          <span style="
            display:inline-block;
            background:${positionColor(player.position)};
            color:#ffffff;
            font-size:10px;
            font-weight:800;
            padding:2px 6px;
            border-radius:4px;
            letter-spacing:0.05em;
            min-width:32px;
            text-align:center;
          ">${player.position}</span>
        </td>
        <td style="padding:10px 16px; border-bottom:1px solid #1f2937; vertical-align:middle;">
          <span style="color:#ffffff; font-weight:700; font-size:14px;">${player.name}</span><br/>
          <span style="color:#6b7280; font-size:12px;">${player.team} · Seed ${player.seed}</span>
        </td>
        <td style="padding:10px 16px; border-bottom:1px solid #1f2937; vertical-align:middle; text-align:right;">
          <span style="color:#9ca3af; font-size:12px;">Rd ${player.round}, Pick ${player.pick}</span>
        </td>
      </tr>
    `)
  ).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0; padding:0; background:#111827; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#111827; padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">

        <!-- Header -->
        <tr>
          <td style="background:#111827; padding:0 0 24px 0; text-align:center;">
            <div style="display:inline-block; background:#15803d; border-radius:8px; padding:6px 14px; margin-bottom:16px;">
              <span style="color:#ffffff; font-size:12px; font-weight:800; letter-spacing:0.1em;">🏈 PLAYOFF FANTASY</span>
            </div>
            <h1 style="color:#ffffff; font-size:28px; font-weight:900; margin:0 0 8px 0; letter-spacing:-0.02em;">
              Your Draft Is In
            </h1>
            <p style="color:#9ca3af; font-size:14px; margin:0;">
              <strong style="color:#d1d5db;">${teamName}</strong> · ${leagueName}
            </p>
          </td>
        </tr>

        <!-- Roster Table -->
        <tr>
          <td style="background:#1f2937; border-radius:12px; overflow:hidden;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr style="background:#111827;">
                <td style="padding:10px 16px;">
                  <span style="color:#6b7280; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">POS</span>
                </td>
                <td style="padding:10px 16px;">
                  <span style="color:#6b7280; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Player</span>
                </td>
                <td style="padding:10px 16px; text-align:right;">
                  <span style="color:#6b7280; font-size:11px; font-weight:700; letter-spacing:0.08em; text-transform:uppercase;">Drafted</span>
                </td>
              </tr>
              ${playerRows}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="padding:24px 0 0 0; text-align:center;">
            <a href="${leagueUrl}" style="
              display:inline-block;
              background:#15803d;
              color:#ffffff;
              font-weight:800;
              font-size:14px;
              padding:12px 28px;
              border-radius:8px;
              text-decoration:none;
              letter-spacing:0.02em;
            ">View Your League →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0 0; text-align:center;">
            <p style="color:#4b5563; font-size:12px; margin:0;">
              Playoff Fantasy Football · playofffantasy.com
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const { leagueId, commissionerUserId } = await req.json();

    if (!leagueId || !commissionerUserId) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify commissioner
    const { data: league } = await supabaseAdmin
      .from("leagues")
      .select("commissioner_user_id, name")
      .eq("id", leagueId)
      .single();

    if (!league || league.commissioner_user_id !== commissionerUserId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all members
    const { data: members } = await supabaseAdmin
      .from("league_members")
      .select("user_id, team_name, draft_position")
      .eq("league_id", leagueId);

    if (!members?.length) {
      return NextResponse.json({ error: "No members found" }, { status: 400 });
    }

    // Get all picks with player info
    const { data: picks } = await supabaseAdmin
      .from("draft_picks")
      .select("user_id, player_id, round, pick_in_round, pick_number")
      .eq("league_id", leagueId)
      .order("pick_number");

    if (!picks?.length) {
      return NextResponse.json({ error: "No picks found" }, { status: 400 });
    }

    // Get all players with team info
    const playerIds = picks.map(p => p.player_id);
    const { data: players } = await supabaseAdmin
      .from("players")
      .select("id, name, position, nfl_team_id, nfl_teams(abbreviation, seed)")
      .in("id", playerIds);

    const playerMap: { [id: number]: any } = {};
    (players || []).forEach(p => { playerMap[p.id] = p; });

    const leagueUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://playoff-fantasy-zeta.vercel.app"}/league/${leagueId}`;

    let sentCount = 0;
    const errors: string[] = [];

    for (const member of members) {
      // Get this member's picks
      const memberPicks = picks.filter(p => p.user_id === member.user_id);

      // Build roster sorted by position
      const roster = memberPicks
        .map(pick => {
          const player = playerMap[pick.player_id];
          if (!player) return null;
          return {
            name: player.name,
            position: player.position,
            team: player.nfl_teams?.abbreviation || "—",
            seed: player.nfl_teams?.seed || 0,
            round: pick.round,
            pick: pick.pick_number,
          };
        })
        .filter(Boolean) as any[];

      // Sort by position order
      roster.sort((a, b) =>
        POSITION_ORDER.indexOf(a.position) - POSITION_ORDER.indexOf(b.position)
      );

      // Get member email
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      const email = userData?.user?.email;
      if (!email) {
        errors.push(`No email for ${member.team_name}`);
        continue;
      }

      const html = buildRosterEmailHtml(member.team_name, league.name, leagueUrl, roster);

      const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: {
            email: "playofffantasyfootballapp@gmail.com",
            name: "Playoff Fantasy Football",
          },
          subject: `🏈 Your ${league.name} Draft Results`,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (sgResponse.ok) {
        sentCount++;
      } else {
        const err = await sgResponse.text();
        errors.push(`Failed for ${member.team_name}: ${err}`);
      }
    }

    return NextResponse.json({ success: true, sentCount, errors });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}