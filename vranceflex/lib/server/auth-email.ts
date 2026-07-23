import { isResendConfigured } from "../auth/config";
import { AuthConfigurationError } from "./auth-crypto";

type AuthEmailKind = "signup_verification" | "password_reset";

export function assertAuthEmailConfigured() {
  if (!isResendConfigured()) {
    throw new AuthConfigurationError(
      "Resend is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL.",
    );
  }
}

function emailCopy(kind: AuthEmailKind, code: string) {
  if (kind === "signup_verification") {
    return {
      subject: "Verify your VranceFlex account",
      heading: "Confirm your email",
      message: "Use this one-time code to finish creating your VranceFlex workspace.",
      code,
    };
  }

  return {
    subject: "Reset your VranceFlex password",
    heading: "Reset your password",
    message: "Use this one-time code to choose a new VranceFlex password.",
    code,
  };
}

export async function sendAuthOtp({
  to,
  code,
  kind,
}: {
  to: string;
  code: string;
  kind: AuthEmailKind;
}) {
  assertAuthEmailConfigured();

  const copy = emailCopy(kind, code);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL!.trim(),
      to: [to],
      subject: copy.subject,
      text: `${copy.heading}\n\n${copy.message}\n\n${copy.code}\n\nThis code expires in 10 minutes. If you did not request it, ignore this email.`,
      html: `
        <div style="background:#f4f2ea;padding:40px 20px;font-family:Arial,sans-serif;color:#0d1e18">
          <div style="max-width:520px;margin:auto;background:#fffdf7;border:1px solid #d8d8cf;border-radius:18px;padding:38px">
            <p style="font-size:11px;letter-spacing:.14em;font-weight:700;color:#315d49">VRANCEFLEX</p>
            <h1 style="font-size:30px;letter-spacing:-.04em;margin:20px 0 12px">${copy.heading}</h1>
            <p style="color:#53635c;line-height:1.6">${copy.message}</p>
            <div style="font-size:34px;letter-spacing:.18em;font-weight:800;background:#c9ff72;padding:18px 22px;border-radius:12px;margin:28px 0;text-align:center">${copy.code}</div>
            <p style="font-size:12px;color:#718078">This code expires in 10 minutes. If you did not request it, ignore this email.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    throw new Error("The verification email could not be sent.");
  }
}
