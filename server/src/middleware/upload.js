import multer from 'multer';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

// Memory storage so the buffer can be verified BEFORE anything touches the disk.
const storage = multer.memoryStorage();

// The stored extension always comes from the verified MIME type, never from the client-supplied filename
// (so "evil.html" uploaded as image/png can never be stored or served as HTML).
export const MIME_EXTENSIONS = {
  'application/pdf': '.pdf',
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/csv': '.csv'
};

const ALLOWED_MIME_TYPES = Object.keys(MIME_EXTENSIONS);

const startsWith = (buf, bytes) => buf.length >= bytes.length && bytes.every((b, i) => buf[i] === b);

/** Verifies the file's magic bytes match the MIME type it claims to be. */
export function verifyFileContent(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return false;
  switch (mimeType) {
    case 'application/pdf': return startsWith(buffer, [0x25, 0x50, 0x44, 0x46]);
    case 'image/png': return startsWith(buffer, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    case 'image/jpeg': return startsWith(buffer, [0xFF, 0xD8, 0xFF]);
    case 'image/webp': return startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    case 'image/gif': return startsWith(buffer, [0x47, 0x49, 0x46, 0x38]); // GIF87a / GIF89a
    case 'application/msword': return startsWith(buffer, [0xD0, 0xCF, 0x11, 0xE0]);
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': return startsWith(buffer, [0x50, 0x4B, 0x03, 0x04]);
    case 'text/plain':
    case 'text/csv': return !buffer.subarray(0, 2048).includes(0x00); // no binary content
    default: return false;
  }
}

function fileFilter(req, file, cb) {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) return cb(null, true);
  return cb(new AppError(
    `Unsupported file type: ${file.mimetype}. Allowed types: PDF, DOC, DOCX, PNG, JPG, WEBP, CSV, TXT`,
    415, 'UNSUPPORTED_MEDIA_TYPE'
  ), false);
}

const multerInstance = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE, files: 1, fields: 60 },
  fileFilter
});

/** Single-file upload middleware with content-signature verification. */
export function uploadSingle(fieldName, { mimeTypes } = {}) {
  const handler = multerInstance.single(fieldName);
  return (req, res, next) => {
    handler(req, res, (err) => {
      if (err) return next(err);
      const file = req.file;
      if (file) {
        if (mimeTypes && !mimeTypes.includes(file.mimetype)) {
          return next(new AppError(`This upload accepts only: ${mimeTypes.join(', ')}`, 415, 'UNSUPPORTED_MEDIA_TYPE'));
        }
        if (!verifyFileContent(file.buffer, file.mimetype)) {
          return next(new AppError('File integrity error: the file content does not match its declared type.', 415, 'FILE_CONTENT_MISMATCH'));
        }
      }
      next();
    });
  };
}

export const RESUME_MIME_TYPES = [
  'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
