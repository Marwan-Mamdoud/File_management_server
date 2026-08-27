import sgMail from "@sendgrid/mail";
import { env } from "./env.js";
import { OtpPurpose } from "../generated/prisma/client.js";
import { AppError } from "../common/errors/app-error.js";

sgMail.setApiKey(env.SENDGRID_API_KEY);

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  try {
    await sgMail.send({
      from: { email: env.SENDGRID_FROM_EMAIL, name: env.SENDGRID_FROM_NAME },
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  } catch (error: any) {
    const message =
      error?.response?.body?.errors?.[0]?.message ?? error.message;
    throw new AppError(
      502,
      "EMAIL_SEND_FAILED",
      `Failed to send email: ${message}`,
    );
  }
}

function otpEmailTemplate(
  code: string,
  heading: string,
  minutes: number,
): string {
  return `
<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;padding:32px;">
            <tr>
              <td style="font-size:20px;font-weight:bold;color:#111827;padding-bottom:8px;">${heading}</td>
            </tr>
            <tr>
              <td style="font-size:14px;color:#4b5563;line-height:1.6;padding-bottom:24px;">
                Use the verification code below. It expires in ${minutes} minutes.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding-bottom:24px;">
                <div style="display:inline-block;font-size:32px;letter-spacing:12px;font-weight:bold;color:#111827;background:#f4f5f7;border-radius:8px;padding:16px 24px;">
                  ${code}
                </div>
              </td>
            </tr>
            <tr>
              <td style="font-size:12px;color:#9ca3af;line-height:1.6;">
                If you didn't request this code, you can safely ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail(
  to: string,
  code: string,
  purpose: OtpPurpose,
  minutes: number,
): Promise<void> {
  const heading =
    purpose === OtpPurpose.EMAIL_VERIFY
      ? "Verify your email"
      : "Reset your password";
  await sendEmail({
    to,
    subject: `${heading} — your code is ${code}`,
    html: otpEmailTemplate(code, heading, minutes),
  });
}
