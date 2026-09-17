"use strict";
/* The guide assistant's free-text mode (§2.100).

   The widget in the frontend works with no backend at all: without an
   ANTHROPIC_API_KEY it answers from the written topics it ships with, and
   this service reports `available: false` so it never pretends otherwise.
   With a key, this is what answers a typed question.

   Raw fetch rather than @anthropic-ai/sdk, for the same reason pinata.js
   and the Brevo mailer use raw fetch: this backend adds a dependency only
   when it buys something a dozen lines of fetch cannot.

   Three things guard a paid endpoint that needs no sign-in: the caps below
   (per IP and platform-wide, counted in the database so a restart cannot
   reset them), a hard ceiling on how much text one request may carry, and
   a system prompt that fixes the assistant's role. None of them is a
   substitute for watching the Anthropic console. */

const config = require("../config");
const repo = require("../data/assistant.repo");
const { buildSystemPrompt } = require("../assistant-knowledge");

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";
const REQUEST_TIMEOUT_MS = 60_000;

/* Answers are short by design (see the system prompt); this is the ceiling
   on one, not a target. Thinking is left at the model's default and the
   effort at "low": a question about how a page works does not need a long
   deliberation, and the latency of one would be felt in a chat bubble.

   `effort` is not a universal parameter: the small and older models reject
   the whole request with a 400 rather than ignore it, so a deployment that
   sets ANTHROPIC_MODEL to one of them (a reasonable thing to do — this is a
   FAQ widget, not a reasoning task) must not have it sent. */
const MAX_OUTPUT_TOKENS = 1200;
const EFFORT = "low";
const EFFORT_UNSUPPORTED = /^claude-(haiku|sonnet-4-5|sonnet-3|opus-4-1|opus-4-20|3-)/;

function supportsEffort(model) {
  return !EFFORT_UNSUPPORTED.test(String(model || ""));
}

/* What one request may carry. A conversation longer than this is trimmed to
   its most recent turns rather than refused — the visitor should not lose a
   working widget because they asked twelve questions. */
const MAX_TURNS = 12;
const MAX_CHARS_PER_MESSAGE = 1200;
const MAX_CHARS_TOTAL = 8000;

/* The caps. Deliberately low: this is a guide for a testnet prototype, not
   a support desk, and the failure mode to avoid is a scripted client
   spending real money overnight. */
const PER_IP_HOURLY = 15;
const PER_IP_DAILY = 50;

function codedError(code, message, extra) {
  return Object.assign(new Error(message), { code, ...extra });
}

/** Whether this deployment can answer typed questions at all. */
function available() {
  return Boolean(config.ANTHROPIC_API_KEY);
}

function status() {
  return {
    available: available(),
    model: available() ? config.ANTHROPIC_MODEL : null,
    maxChars: MAX_CHARS_PER_MESSAGE
  };
}

/** Keeps the last `MAX_TURNS` messages, drops anything that is not a
 * non-empty user/assistant text turn, and truncates over-long ones. The
 * history comes from the browser, so none of it is trusted: it is content
 * for the model, never an instruction to this server. */
function normalizeMessages(input) {
  if (!Array.isArray(input)) throw codedError("invalid", "messages must be an array");
  const cleaned = [];
  for (const m of input) {
    const role = m && m.role === "assistant" ? "assistant" : "user";
    const content = String((m && m.content) || "").trim();
    if (!content) continue;
    cleaned.push({ role, content: content.slice(0, MAX_CHARS_PER_MESSAGE) });
  }
  if (!cleaned.length) throw codedError("invalid", "ask a question first");
  // The API requires the conversation to start with a user turn.
  let trimmed = cleaned.slice(-MAX_TURNS);
  while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
  if (!trimmed.length) throw codedError("invalid", "ask a question first");
  if (trimmed[trimmed.length - 1].role !== "user") {
    throw codedError("invalid", "the last message must be the visitor's question");
  }
  const total = trimmed.reduce((n, m) => n + m.content.length, 0);
  if (total > MAX_CHARS_TOTAL) {
    // Drop from the front until it fits, keeping the current question.
    while (trimmed.length > 1 && trimmed.reduce((n, m) => n + m.content.length, 0) > MAX_CHARS_TOTAL) {
      trimmed = trimmed.slice(1);
      while (trimmed.length && trimmed[0].role !== "user") trimmed = trimmed.slice(1);
    }
  }
  return trimmed;
}

async function enforceLimits(ip) {
  const now = Date.now();
  const hourAgo = new Date(now - 60 * 60 * 1000).toISOString();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

  if (await repo.countSince(null, dayAgo) >= config.ASSISTANT_DAILY_CAP) {
    throw codedError("rate-limited", "the assistant has answered as many questions as it can today; the written topics still work", { retryAfter: 3600 });
  }
  if (ip) {
    if (await repo.countSince(ip, hourAgo) >= PER_IP_HOURLY) {
      throw codedError("rate-limited", "too many questions in the last hour; try again later", { retryAfter: 900 });
    }
    if (await repo.countSince(ip, dayAgo) >= PER_IP_DAILY) {
      throw codedError("rate-limited", "too many questions today; try again tomorrow", { retryAfter: 3600 });
    }
  }
}

/** Pulls the answer text out of a Messages API response, and refuses to
 * invent one when the model declined or was cut off mid-sentence. */
function readReply(payload) {
  if (payload?.stop_reason === "refusal") {
    throw codedError("refused", "the assistant did not answer that one");
  }
  const text = (payload?.content || [])
    .filter((block) => block?.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw codedError("upstream", "the assistant returned an empty answer");
  return { text, truncated: payload?.stop_reason === "max_tokens" };
}

/**
 * Answers one question. `messages` is the visible conversation so far,
 * oldest first; `locale` only picks the language.
 * Throws with `code`: "not-configured", "invalid", "rate-limited",
 * "refused", "upstream".
 */
async function ask({ messages, locale, ip }) {
  if (!available()) throw codedError("not-configured", "the assistant is not available on this server");
  const conversation = normalizeMessages(messages);
  await enforceLimits(ip);

  let response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": config.ANTHROPIC_API_KEY,
        "anthropic-version": API_VERSION
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        model: config.ANTHROPIC_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        ...(supportsEffort(config.ANTHROPIC_MODEL) ? { output_config: { effort: EFFORT } } : {}),
        /* The brief is the same on every request and dwarfs the question,
           so it is cached: the second question within five minutes reads it
           back at a tenth of the price instead of paying for it again. */
        system: [{ type: "text", text: buildSystemPrompt(locale), cache_control: { type: "ephemeral" } }],
        messages: conversation
      })
    });
  } catch (e) {
    throw codedError("upstream", e.name === "TimeoutError" ? "the assistant took too long to answer" : String(e.message || e));
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    /* The upstream message can name the key or the account; the route turns
       this into a generic 502 and only the server log sees the detail. */
    throw codedError("upstream", payload?.error?.message || `Anthropic API returned ${response.status}`, { status: response.status });
  }

  const { text, truncated } = readReply(payload);
  // Recorded after a successful answer, which is also what was billed.
  await repo.insertRequest({
    ip: ip || null,
    createdAt: new Date().toISOString(),
    inputTokens: payload?.usage?.input_tokens ?? null,
    outputTokens: payload?.usage?.output_tokens ?? null
  });
  return { reply: text, truncated, model: payload?.model || config.ANTHROPIC_MODEL };
}

/** What the widget has cost over the last 24 hours and 30 days. Reads no
 * question and no answer — there are none stored. */
async function usage() {
  const now = Date.now();
  return {
    day: await repo.usageSince(new Date(now - 24 * 60 * 60 * 1000).toISOString()),
    month: await repo.usageSince(new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()),
    dailyCap: config.ASSISTANT_DAILY_CAP
  };
}

/** Rows older than the widest window any cap looks at (24h) are only kept
 * for the usage view; a month is plenty. Called from the route, cheaply. */
async function prune() {
  await repo.deleteBefore(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
}

module.exports = { ask, status, available, usage, prune, supportsEffort };
