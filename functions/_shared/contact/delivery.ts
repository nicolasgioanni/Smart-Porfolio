import { isValidEmail } from "../../../src/lib/contact/validation";
import { isValidFromMailbox } from "./config";
import type { ContactEnv, ContactPayload, EmailMessage } from "./contracts";
import { fetchWithTimeout } from "./transport";

const RESEND_EMAIL_URL = "https://api.resend.com/emails";
const CANONICAL_SITE_URL = "https://nicolasmgioanni.dev";
const RESEND_TIMEOUT_MS = 8_000;

export async function sendContactEmails(
  payload: ContactPayload,
  env: ContactEnv,
  reservationTimestamp = Math.floor(Date.now() / 1_000)
): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  const recipient = env.CONTACT_RECIPIENT_EMAIL?.trim();
  const fromEmail = env.CONTACT_FROM_EMAIL?.trim();
  const replyToEmail = env.CONTACT_REPLY_TO_EMAIL?.trim();
  if (
    !apiKey ||
    !recipient ||
    !isValidEmail(recipient) ||
    !fromEmail ||
    !isValidFromMailbox(fromEmail) ||
    !replyToEmail ||
    !isValidEmail(replyToEmail)
  ) {
    return false;
  }

  const reservationYear = new Date(reservationTimestamp * 1_000).getUTCFullYear();
  if (!Number.isSafeInteger(reservationYear)) return false;

  const [visitorMessage, ownerMessage] = createEmailMessages(
    payload,
    recipient,
    fromEmail,
    replyToEmail,
    reservationYear
  );
  const visitorAccepted = await sendResendEmail(
    visitorMessage,
    apiKey,
    `portfolio-contact/visitor/${payload.submissionId}`
  );
  if (!visitorAccepted) return false;

  return sendResendEmail(ownerMessage, apiKey, `portfolio-contact/owner/${payload.submissionId}`);
}

export function createEmailMessages(
  payload: ContactPayload,
  recipient: string,
  fromEmail: string,
  replyToEmail: string,
  reservationYear = new Date().getUTCFullYear()
): [EmailMessage, EmailMessage] {
  const fullName = `${payload.firstName} ${payload.lastName}`;
  const phone = payload.phone || "Not provided";
  const escapedName = escapeHtml(fullName);
  const escapedEmail = escapeHtml(payload.email);
  const escapedPhone = escapeHtml(phone);
  const escapedMessage = escapeHtml(payload.message).replace(/\n/g, "<br>");

  const ownerText = [
    `New contact request from ${fullName}`,
    "",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "",
    "Message:",
    payload.message
  ].join("\n");

  const confirmationText = [
    `Hi ${payload.firstName},`,
    "",
    "Thank you for reaching out. I received your message and will get back to you as soon as I can.",
    "",
    "Information you submitted",
    `Name: ${fullName}`,
    `Email: ${payload.email}`,
    `Phone: ${phone}`,
    "Message:",
    payload.message,
    "",
    `If you need to correct or update this information, please submit a new form at ${CANONICAL_SITE_URL}/contact or email ${replyToEmail}.`,
    "",
    "This is an automated confirmation. Replies are directed to the email address above.",
    "",
    `Privacy Notice: ${CANONICAL_SITE_URL}/privacy`,
    `Site Terms & Accuracy Notice: ${CANONICAL_SITE_URL}/terms`,
    `© ${reservationYear} Nicolas Gioanni. All rights reserved.`
  ].join("\n");

  return [
    {
      from: fromEmail,
      to: [payload.email],
      reply_to: replyToEmail,
      subject: "I received your message!",
      text: confirmationText,
      html: emailShell(
        "MESSAGE CONFIRMATION",
        "I received your message!",
        `<p style="margin:0 0 12px;color:#334155;line-height:1.65;">Hi ${escapeHtml(payload.firstName)},</p><p style="margin:0 0 20px;color:#334155;line-height:1.65;">Thank you for reaching out. I received your message and will get back to you as soon as I can.</p>${detailTable(
          "Information you submitted",
          [
            ["Name", escapedName],
            ["Email", escapedEmail],
            ["Phone", escapedPhone]
          ],
          escapedMessage
        )}<div style="margin-top:20px;padding:14px;border:1px solid #cbd8e6;border-radius:8px;background:#f7fafc;color:#334155;font-size:13px;line-height:1.6;">If you need to correct or update this information, please <a href="${CANONICAL_SITE_URL}/contact" style="color:#174f87;font-weight:600;">submit a new form</a> or email <a href="mailto:${escapeHtml(replyToEmail)}" style="color:#174f87;font-weight:600;">${escapeHtml(replyToEmail)}</a>.</div>`,
        visitorLegalFooter(reservationYear)
      )
    },
    {
      from: fromEmail,
      to: [recipient],
      reply_to: payload.email,
      subject: `New contact request from ${fullName}`,
      text: ownerText,
      html: emailShell(
        "NEW CONTACT REQUEST",
        escapedName,
        `<p style="margin:0 0 20px;color:#334155;line-height:1.65;">A new message was submitted through nicolasmgioanni.dev.</p>${detailTable(
          "Contact information",
          [
            ["Name", escapedName],
            [
              "Email",
              `<a href="mailto:${escapedEmail}" style="color:#174f87;font-weight:700;">${escapedEmail}</a>`
            ],
            ["Phone", escapedPhone]
          ],
          escapedMessage
        )}<p style="margin:20px 0 0;color:#475569;font-size:13px;line-height:1.6;">Reply directly to this email to contact ${escapedName}.</p>`
      )
    }
  ];
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

async function sendResendEmail(message: EmailMessage, apiKey: string, idempotencyKey: string): Promise<boolean> {
  const response = await fetchWithTimeout(
    RESEND_EMAIL_URL,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey
      },
      body: JSON.stringify(message)
    },
    RESEND_TIMEOUT_MS
  );
  return response?.ok === true;
}

function detailTable(title: string, rows: Array<[string, string]>, escapedMessage: string): string {
  const rowMarkup = rows
    .map(
      ([label, value]) =>
        `<tr><td style="width:34%;padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#64748b;font-size:12px;vertical-align:top;">${label}</td><td style="padding:10px 12px;border-bottom:1px solid #dbe4ee;color:#102a46;font-size:13px;font-weight:600;overflow-wrap:anywhere;">${value}</td></tr>`
    )
    .join("");

  return `<div style="overflow:hidden;border:1px solid #cbd8e6;border-radius:8px;background:#ffffff;"><div style="padding:12px;color:#102a46;font-size:13px;font-weight:700;background:#f7fafc;border-bottom:1px solid #dbe4ee;">${title}</div><table role="presentation" style="width:100%;border-collapse:collapse;">${rowMarkup}<tr><td colspan="2" style="padding:12px;"><div style="margin-bottom:6px;color:#64748b;font-size:12px;">Message</div><div style="color:#102a46;font-size:13px;line-height:1.6;overflow-wrap:anywhere;">${escapedMessage}</div></td></tr></table></div>`;
}

function visitorLegalFooter(reservationYear: number): string {
  return `<a href="${CANONICAL_SITE_URL}/privacy" style="color:#dbe8f5;text-decoration:underline;">Privacy Notice</a><span style="padding:0 8px;color:#7995b2;">|</span><a href="${CANONICAL_SITE_URL}/terms" style="color:#dbe8f5;text-decoration:underline;">Site Terms &amp; Accuracy Notice</a><div style="margin-top:8px;">© ${reservationYear} Nicolas Gioanni. All rights reserved.</div>`;
}

function emailShell(label: string, title: string, content: string, footer = "nicolasmgioanni.dev"): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" style="width:100%;border-collapse:collapse;background:#eef3f8;"><tr><td style="padding:24px 12px;"><table role="presentation" style="width:100%;max-width:620px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-top:4px solid #173f68;"><tr><td style="padding:30px 28px 12px;"><div style="margin-bottom:8px;color:#456b91;font-size:10px;font-weight:700;letter-spacing:1.4px;">${label}</div><h1 style="margin:0;color:#0b2540;font-size:24px;line-height:1.25;">${title}</h1></td></tr><tr><td style="padding:12px 28px 30px;">${content}</td></tr><tr><td style="padding:18px 28px;background:#0b2540;color:#cbd8e6;font-size:11px;line-height:1.5;text-align:center;">${footer}</td></tr></table></td></tr></table></body></html>`;
}
