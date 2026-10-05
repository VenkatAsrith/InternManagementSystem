import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const passthrough = (req, res, next) => next();

function limiter(max, code, message, windowMs = env.RATE_LIMIT_WINDOW_MS) {
  if (env.RATE_LIMIT_DISABLED) return passthrough;
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { code, message } }
  });
}

// General API traffic
export const apiLimiter = limiter(env.RATE_LIMIT_MAX_REQUESTS, 'RATE_LIMIT_EXCEEDED', 'Too many requests from this IP, please try again later.');

// Login / refresh / password setup
export const authLimiter = limiter(env.AUTH_RATE_LIMIT_MAX, 'AUTH_RATE_LIMIT_EXCEEDED', 'Too many authentication attempts. Please try again after 15 minutes.');

// Anonymous endpoints that could be scraped or enumerated: application status, certificate verification, offer links.
export const publicLimiter = limiter(env.PUBLIC_RATE_LIMIT_MAX, 'PUBLIC_RATE_LIMIT_EXCEEDED', 'Too many lookups from this IP. Please slow down and try again shortly.');

// Public application submissions (each one stores a file and creates records)
export const applyLimiter = limiter(Math.max(10, Math.floor(env.PUBLIC_RATE_LIMIT_MAX / 3)), 'APPLY_RATE_LIMIT_EXCEEDED', 'Too many applications submitted from this network. Please try again later.', 60 * 60 * 1000);
