// ─── Network Retry Utility ───────────────────────────────────────────────────
// Wraps async functions with exponential backoff retry logic.
// Essential for slow/intermittent mobile connections.

/**
 * Retry an async function with exponential backoff.
 * @param {Function} fn - Async function to retry
 * @param {number} maxAttempts - Maximum retry attempts (default 3)
 * @param {number} baseDelay - Base delay in ms (default 1000)
 */
export async function withRetry(fn, maxAttempts = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      // Don't retry permission errors or auth errors
      if (err?.code?.startsWith('permission') ||
          err?.code?.startsWith('auth/') ||
          err?.message?.includes('already marked')) {
        throw err;
      }
      if (attempt < maxAttempts) {
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(r => setTimeout(r, baseDelay * Math.pow(2, attempt - 1)));
      }
    }
  }
  throw lastError;
}

/**
 * Check if the device has a network connection.
 */
export function isOnline() {
  return navigator.onLine !== false;
}

/**
 * Wait for network to come back online.
 */
export function waitForOnline() {
  return new Promise(resolve => {
    if (navigator.onLine !== false) { resolve(); return; }
    const handler = () => { window.removeEventListener('online', handler); resolve(); };
    window.addEventListener('online', handler);
  });
}
