/**
 * In-memory rate limit tracker for external API calls.
 * Tracks usage per API with monthly or daily windows.
 * For single-server deployment — migrate to Redis for multi-instance.
 */

const limits = {
  platerecognizer: { max: 2500, window: 'monthly' },
  here: { max: 250000, window: 'monthly' },
  azure: { max: 250000, window: 'monthly' },
  tomtom: { max: 2500, window: 'daily' },
  rekor: { max: 10000, window: 'monthly' }
};

const counters = new Map();

function getWindowKey(apiName) {
  const now = new Date();
  const config = limits[apiName];
  if (!config) return `${apiName}-unknown`;

  if (config.window === 'daily') {
    return `${apiName}-${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;
  }
  return `${apiName}-${now.getFullYear()}-${now.getMonth()}`;
}

/**
 * Check if an API call is within rate limits
 * @returns {boolean} true if allowed
 */
export function checkLimit(apiName) {
  const config = limits[apiName];
  if (!config) return true; // Unknown API, allow by default

  const key = getWindowKey(apiName);
  const current = counters.get(key) || 0;
  return current < config.max;
}

/**
 * Increment the counter for an API
 * @param {string} apiName
 * @param {number} count - Number of calls to record (default 1)
 */
export function increment(apiName, count = 1) {
  const key = getWindowKey(apiName);
  const current = counters.get(key) || 0;
  counters.set(key, current + count);
}

/**
 * Get current usage stats for an API
 */
export function getUsage(apiName) {
  const config = limits[apiName];
  if (!config) return null;

  const key = getWindowKey(apiName);
  const current = counters.get(key) || 0;

  return {
    apiName,
    used: current,
    max: config.max,
    remaining: Math.max(0, config.max - current),
    window: config.window
  };
}

/**
 * Get usage stats for all tracked APIs
 */
export function getAllUsage() {
  return Object.keys(limits).map(getUsage);
}

// Clean up old window keys every hour
setInterval(() => {
  const validKeys = new Set(Object.keys(limits).map(getWindowKey));
  for (const key of counters.keys()) {
    if (!validKeys.has(key)) {
      counters.delete(key);
    }
  }
}, 3600000);
