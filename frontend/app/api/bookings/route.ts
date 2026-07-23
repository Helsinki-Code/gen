import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { BRAND } from "@/lib/brand";
import { readEnvValue } from "@/lib/read-env";

const VALID_BOOKING_TYPES = ["pipeline_demo", "outbound_workflow", "enterprise_consultation"] as const;
type BookingType = (typeof VALID_BOOKING_TYPES)[number];

const BOOKING_LABELS: Record<BookingType, string> = {
  pipeline_demo: "Live Pipeline Demo (30 min)",
  outbound_workflow: "Outbound Workflow Review (30 min)",
  enterprise_consultation: "Enterprise Consultation (45 min)",
};

const rateMap = new Map<string, number[]>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateMap.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) {
    rateMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateMap.set(ip, timestamps);
  return false;
}

function validateBookingBody(body: Record<string, unknown>): string | null {
  if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
    return "Name is required (min 2 characters).";
  }
  if (!body.email || typeof body.email !== "string" || !EMAIL_RE.test(body.email.trim())) {
    return "A valid email address is required.";
  }
  if (!body.bookingType || !VALID_BOOKING_TYPES.includes(body.bookingType as BookingType)) {
    return `bookingType must be one of: ${VALID_BOOKING_TYPES.join(", ")}`;
  }
  if ((body.name as string).length > 200) return "Name must be 200 characters or fewer.";
  if ((body.email as string).length > 255) return "Email must be 255 characters or fewer.";
  if (body.company && typeof body.company === "string" && body.company.length > 200) {
    return "Company must be 200 characters or fewer.";
  }
  if (body.message && typeof body.message === "string" && body.message.length > 5000) {
    return "Message must be 5000 characters or fewer.";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validationError = validateBookingBody(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const resendApiKey = readEnvValue("RESEND_API_KEY");
  const fromEmail =
    readEnvValue("RESEND_FROM_EMAIL") ||
    readEnvValue("ARTICLE_NOTIFY_FROM") ||
    `AmroGen <${BRAND.helloEmail}>`;
  const notifyEmail = readEnvValue("BOOKING_NOTIFY_EMAIL") || BRAND.helloEmail;

  if (!resendApiKey) {
    return NextResponse.json(
      { error: "Booking email is not configured. Please email us directly or use the AmroMeet calendar above." },
      { status: 503 },
    );
  }

  const resend = new Resend(resendApiKey);
  const name = (body.name as string).trim();
  const email = (body.email as string).trim().toLowerCase();
  const company = body.company ? (body.company as string).trim() || null : null;
  const bookingType = body.bookingType as BookingType;
  const preferredDate = body.preferredDate ? (body.preferredDate as string).trim() || null : null;
  const preferredTime = body.preferredTime ? (body.preferredTime as string).trim() || null : null;
  const timezone = body.timezone ? (body.timezone as string).trim() || null : null;
  const message = body.message ? (body.message as string).trim() || null : null;
  const label = BOOKING_LABELS[bookingType];

  const dateInfo = preferredDate
    ? `<p><strong>Preferred date:</strong> ${preferredDate}${preferredTime ? ` — ${preferredTime}` : ""}${timezone ? ` (${timezone})` : ""}</p>`
    : "";

  const confirmationHtml = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px; margin: 0 auto;">
      <p>Dear ${name},</p>
      <p>Thank you for booking a <strong>${label}</strong> session with ${BRAND.productName}.</p>
      ${dateInfo}
      <p>Our team will reach out within 24 hours to confirm your time slot.</p>
      <p>Questions? Reply to this email or contact us at ${BRAND.contactEmail}.</p>
      <p>— The ${BRAND.legalEntity} Team</p>
    </div>
  `;

  const teamHtml = `
    <div style="font-family: system-ui, sans-serif; max-width: 600px;">
      <h2>New AmroGen demo booking</h2>
      <p><strong>Session:</strong> ${label}</p>
      <p><strong>Name:</strong> ${name}</p>
      <p><strong>Email:</strong> ${email}</p>
      ${company ? `<p><strong>Company:</strong> ${company}</p>` : ""}
      ${dateInfo}
      ${message ? `<p><strong>Message:</strong><br/>${message.replace(/\n/g, "<br/>")}</p>` : ""}
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Booking Confirmed — ${label} | ${BRAND.productName}`,
      html: confirmationHtml,
    });

    await resend.emails.send({
      from: fromEmail,
      to: notifyEmail,
      replyTo: email,
      subject: `[AmroGen] New demo booking — ${name} (${label})`,
      html: teamHtml,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send confirmation email. Please try the AmroMeet calendar or email us directly." },
      { status: 502 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Your demo session has been booked. We will be in touch within 24 hours.",
  });
}
