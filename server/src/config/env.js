import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root or project root.
// QA runs pass ENV_FILE=.env.qa (never the developer's real .env) so the QA suite can never touch real data.
if (process.env.ENV_FILE) {
  dotenv.config({ path: path.resolve(process.env.ENV_FILE) });
}
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const isProd = process.env.NODE_ENV === 'production';

// Production safety verification (§11)
if (isProd) {
  const required = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'MONGO_URI'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`CRITICAL STARTUP ERROR: Missing mandatory production environment variables: ${missing.join(', ')}`);
  }
}

const int = (key, fallback) => {
  const n = parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
};

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: int('PORT', 5000),
  APP_URL: process.env.APP_URL || 'http://localhost:5000',
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:3000',

  // Database
  MONGO_URI: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/intern_management_system',

  // JWT & Authentication
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'ims_jwt_super_secret_access_key_2026_!@#$%^',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'ims_jwt_super_secret_refresh_key_2026_&*()_+',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '2h',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  COOKIE_SECRET: process.env.COOKIE_SECRET || 'tmt_cookie_signing_secret_2026_!@#$%',
  BCRYPT_SALT_ROUNDS: int('BCRYPT_SALT_ROUNDS', 10),
  PASSWORD_SETUP_TTL_HOURS: int('PASSWORD_SETUP_TTL_HOURS', 168),

  // Storage
  STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
  UPLOAD_DIR: process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../uploads'),
  TEMP_UPLOAD_DIR: process.env.TEMP_UPLOAD_DIR || path.resolve(__dirname, '../../../uploads/temp'),
  MAX_FILE_SIZE: int('MAX_FILE_SIZE', 10485760), // 10 MB

  // Cloudinary Storage Credentials
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
  CLOUDINARY_SECURE: process.env.CLOUDINARY_SECURE !== 'false',

  // SMTP Email Engine (Primary & Secondary Failover)
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.mailtrap.io',
  SMTP_PORT: int('SMTP_PORT', 587),
  SMTP_SECURE: process.env.SMTP_SECURE === 'true',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASSWORD: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
  SMTP_PASS: process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '',
  SMTP_FROM_NAME: process.env.SMTP_FROM_NAME || 'LearningSpaces',
  SMTP_FROM_EMAIL: process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'talent@techmecha.com',
  EMAIL_FROM: process.env.EMAIL_FROM || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'talent@techmecha.com',
  SMTP_LIMIT_PER_HOUR: int('SMTP_LIMIT_PER_HOUR', 450),

  // Secondary SMTP (Failover)
  SMTP2_HOST: process.env.SMTP2_HOST || '',
  SMTP2_PORT: int('SMTP2_PORT', 587),
  SMTP2_SECURE: process.env.SMTP2_SECURE === 'true',
  SMTP2_USER: process.env.SMTP2_USER || '',
  SMTP2_PASSWORD: process.env.SMTP2_PASS || process.env.SMTP2_PASSWORD || '',
  SMTP2_PASS: process.env.SMTP2_PASS || process.env.SMTP2_PASSWORD || '',
  EMAIL2_FROM: process.env.EMAIL2_FROM || process.env.SMTP2_USER || '',

  // Rate limiting (honoured by middleware/rateLimiter.js). RATE_LIMIT_DISABLED=true is refused in production.
  RATE_LIMIT_DISABLED: process.env.RATE_LIMIT_DISABLED === 'true' && !isProd,
  RATE_LIMIT_WINDOW_MS: int('RATE_LIMIT_WINDOW_MS', 900000),
  RATE_LIMIT_MAX_REQUESTS: int('RATE_LIMIT_MAX_REQUESTS', 1000),
  AUTH_RATE_LIMIT_MAX: int('AUTH_RATE_LIMIT_MAX', 30),
  PUBLIC_RATE_LIMIT_MAX: int('PUBLIC_RATE_LIMIT_MAX', 60),

  // Business configuration (documented in docs/qa/CANONICAL_RULES.md)
  ORG_TIMEZONE: process.env.ORG_TIMEZONE || 'Asia/Kolkata',
  ATTENDANCE_WORKDAY_START: process.env.ATTENDANCE_WORKDAY_START || '09:30',
  ATTENDANCE_GRACE_MINUTES: int('ATTENDANCE_GRACE_MINUTES', 15),
  ATTENDANCE_HALF_DAY_HOURS: parseFloat(process.env.ATTENDANCE_HALF_DAY_HOURS || '4'),
  ATTENDANCE_FULL_DAY_HOURS: parseFloat(process.env.ATTENDANCE_FULL_DAY_HOURS || '7'),
  OFFER_VALIDITY_DAYS: int('OFFER_VALIDITY_DAYS', 7),
  DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT: int('DEFAULT_ATTENDANCE_REQUIREMENT_PERCENT', 85),
  DEFAULT_MIN_TASKS_FOR_CERTIFICATE: int('DEFAULT_MIN_TASKS_FOR_CERTIFICATE', 5),

  // Google Workspace & Calendar Integration (OAuth 2.0)
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || '',
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL || 'http://localhost:5000'}/api/v1/integrations/google/oauth-callback`,
  GOOGLE_CALENDAR_ID: process.env.GOOGLE_CALENDAR_ID || 'primary',
  APP_BASE_URL: process.env.APP_BASE_URL || process.env.APP_URL || 'http://localhost:5000',

  // Test hooks. Accepted ONLY when NODE_ENV=test|qa, never in development/production.
  QA_FAULT_INJECTION: ['test', 'qa'].includes(process.env.NODE_ENV || '') && process.env.QA_FAULT_INJECTION === 'true'
};
