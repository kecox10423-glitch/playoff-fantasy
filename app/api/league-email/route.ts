import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { leagueId, userId, subject, message, recipientIds } = await req.json();

    if (!leagueId || !userId || !subject || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify the requester is the commissioner
    const { data: league, error: leagueError } = await supabaseAdmin
      .from("leagues")
      .select("commissioner_user_id, name")
      .eq("id", leagueId)
      .single();

    if (leagueError || !league) {
      return NextResponse.json({ error: "League not found" }, { status: 404 });
    }

    if (league.commissioner_user_id !== userId) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Get all league members
    const { data: members, error: membersError } = await supabaseAdmin
      .from("league_members")
      .select("user_id, team_name")
      .eq("league_id", leagueId);

    if (membersError || !members) {
      return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
    }

    // Filter to selected recipients if provided
    const targetMembers = Array.isArray(recipientIds) && recipientIds.length > 0
      ? members.filter(m => recipientIds.includes(m.user_id))
      : members;

    if (targetMembers.length === 0) {
      return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
    }

    // Get email addresses for selected members via auth admin API
    const emails: string[] = [];
    for (const member of targetMembers) {
      const { data: userData } = await supabaseAdmin.auth.admin.getUserById(member.user_id);
      if (userData?.user?.email) {
        emails.push(userData.user.email);
      }
    }

    if (emails.length === 0) {
      return NextResponse.json({ error: "No member emails found" }, { status: 400 });
    }

    // Send via SendGrid
    const sgResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: emails.map(email => ({ email })),
          },
        ],
        from: {
          email: "playofffantasyfootballapp@gmail.com",
          name: `${league.name} (PFFL)`,
        },
        subject: subject,
        content: [
          {
            type: "text/plain",
            value: message,
          },
        ],
      }),
    });

    if (!sgResponse.ok) {
      const errText = await sgResponse.text();
      console.error("SendGrid error:", errText);
      return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sentTo: emails.length });
  } catch (err) {
    console.error("League email error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}