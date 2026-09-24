/**
 * Validation and Sanitization Module for QQSI Quiz Show Platform
 */

const RATE_LIMIT_WINDOW_MS = 10000; // 10 seconds
const MAX_AUTH_ATTEMPTS = 8;
const MAX_SUBMISSIONS_PER_QUESTION = 3;

const attemptsMap = new Map();

function cleanString(str, maxLen = 100) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/[\x00-\x1F\x7F]/g, '') // remove control characters
    .trim()
    .slice(0, maxLen);
}

function checkRateLimit(key, limit = MAX_AUTH_ATTEMPTS, windowMs = RATE_LIMIT_WINDOW_MS) {
  const now = Date.now();
  const record = attemptsMap.get(key) || { count: 0, resetAt: now + windowMs };

  if (now > record.resetAt) {
    record.count = 1;
    record.resetAt = now + windowMs;
    attemptsMap.set(key, record);
    return true;
  }

  record.count++;
  attemptsMap.set(key, record);
  return record.count <= limit;
}

// Clean up stale rate-limit records periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of attemptsMap.entries()) {
    if (now > record.resetAt + 60000) {
      attemptsMap.delete(key);
    }
  }
}, 30000);
if (cleanupInterval && cleanupInterval.unref) {
  cleanupInterval.unref();
}

const VALID_TEAM_IDS = ['sistemas', 'alimentos', 'quimica', 'civil', 'petroquimica'];

module.exports = {
  cleanString,
  checkRateLimit,

  isValidTeamId(teamId) {
    if (!teamId || typeof teamId !== 'string') return false;
    return VALID_TEAM_IDS.includes(teamId.toLowerCase().trim());
  },

  isValidNumber(val, min = 0, max = 100) {
    if (typeof val !== 'number' || isNaN(val) || !isFinite(val)) return false;
    return val >= min && val <= max;
  },

  sanitizePayload(payload) {
    if (!payload || typeof payload !== 'object') return {};
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') {
        sanitized[key] = cleanString(value, 150);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = value.slice(0, 50);
      }
    }
    return sanitized;
  }
};
