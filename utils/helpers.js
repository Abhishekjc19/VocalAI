// utils/helpers.js — shared utilities

/**
 * Sleep for `ms` milliseconds.
 */
export function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

/**
 * Retry an async function up to `maxRetries` times with exponential back-off.
 * Retries on network errors and 429 / 5xx responses.
 */
export async function withRetry(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Retry on rate-limit or server errors
      if (result && typeof result.status === "number") {
        if (result.status === 429 || result.status >= 500) {
          const retryAfter =
            parseInt(result.headers?.get?.("retry-after") ?? "0") * 1000 ||
            baseDelay * 2 ** (attempt - 1);

          if (attempt < maxRetries) {
            console.warn(
              `  [retry] HTTP ${result.status} — waiting ${retryAfter}ms (attempt ${attempt}/${maxRetries})`
            );
            await sleep(retryAfter);
            continue;
          }
        }
      }

      return result;
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries) {
        const delay = baseDelay * 2 ** (attempt - 1);
        console.warn(
          `  [retry] ${err.message} — waiting ${delay}ms (attempt ${attempt}/${maxRetries})`
        );
        await sleep(delay);
      }
    }
  }

  throw lastError ?? new Error("Max retries exceeded");
}

/**
 * Chunk an array into batches of size `n`.
 */
export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) {
    out.push(arr.slice(i, i + n));
  }
  return out;
}

/**
 * Remove duplicate items from an array by a key function.
 */
export function dedupe(arr, keyFn) {
  const seen = new Set();
  return arr.filter((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
