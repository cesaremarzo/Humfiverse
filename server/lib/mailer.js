"use strict";
/* Transactional email (§2.93) through Brevo's HTTP API — no SDK, the same
   near-zero-dependency approach as pinata.js. One call, one message. */

const { BREVO_API_KEY, EMAIL_FROM, EMAIL_FROM_NAME, EMAIL_DEV_LOG } = require("../config");

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

function enabled() {
  return Boolean(BREVO_API_KEY && EMAIL_FROM) || EMAIL_DEV_LOG;
}

async function sendEmail({ to, subject, text, html }) {
  if (BREVO_API_KEY && EMAIL_FROM) {
    const res = await fetch(BREVO_URL, {
      method: "POST",
      headers: { "api-key": BREVO_API_KEY, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        sender: { email: EMAIL_FROM, name: EMAIL_FROM_NAME },
        to: [{ email: to }],
        subject,
        textContent: text,
        htmlContent: html
      })
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Brevo send failed (${res.status}): ${detail || res.statusText}`);
    }
    return;
  }
  if (EMAIL_DEV_LOG) {
    console.log(`[mailer:dev] to=${to} subject=${JSON.stringify(subject)}\n${text}`);
    return;
  }
  throw Object.assign(new Error("email sending is not configured"), { code: "not-configured" });
}

module.exports = { enabled, sendEmail };
