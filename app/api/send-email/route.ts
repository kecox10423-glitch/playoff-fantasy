import sgMail from "@sendgrid/mail";
import { NextResponse } from "next/server";

sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function POST(request: Request) {
  const { to, subject, body } = await request.json();

  try {
    await sgMail.send({
      to,
      from: "kecox10423@gmail.com",
      subject,
      text: body,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #111827; color: white; padding: 32px; border-radius: 12px;">
        <h1 style="color: #22c55e; margin-bottom: 8px;">Playoff Fantasy</h1>
        <p style="color: #9ca3af; margin-bottom: 24px;">Draft once. Survive the playoffs.</p>
        <div style="background: #1f2937; padding: 24px; border-radius: 8px;">
          ${body.replace(/\n/g, "<br>")}
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">playoff-fantasy-zeta.vercel.app</p>
      </div>`,
    });

    return NextResponse.json({ message: "Email sent" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}