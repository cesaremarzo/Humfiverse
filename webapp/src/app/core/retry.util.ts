/**
 * Retries a promise-returning call a few times before giving up.
 *
 * The on-chain reads this wraps go to a free-tier Render instance that
 * sleeps after 15 minutes idle, and from there to a free-tier RPC. A cold
 * first request can take the better part of a minute, and sometimes simply
 * fails. One attempt was all the app made, and a single failed read left
 * the asset page and every card unable to say how much of a campaign had
 * actually sold — for the rest of the page's life, since nothing retried.
 *
 * Deliberately small and bounded: three attempts with a short backoff, not
 * an indefinite poll. If the chain genuinely cannot be read, the UI falls
 * back to its plain counter and says nothing it cannot support.
 */
export async function retrying<T>(call: () => Promise<T>, attempts = 3, baseDelayMs = 1200): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await call();
    } catch (err) {
      lastError = err;
      if (attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
  throw lastError;
}
