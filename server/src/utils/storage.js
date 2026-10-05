import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { AppError } from './errors.js';
import { MIME_EXTENSIONS } from '../middleware/upload.js';

/**
 * Enterprise Storage Service supporting both Cloudinary and secure private local storage.
 *
 * - Cloudinary integration: Files are streamed to Cloudinary object storage with folder hierarchies.
 * - Dual-layer caching: Files are mirrored locally so Express streaming & Nodemailer attachments
 *   operate with zero latency and high reliability.
 * - Automatic Fallback: If Cloudinary keys are empty or the network fails, it seamlessly falls
 *   back to secure local storage without interrupting user workflows.
 */
export class StorageService {
  constructor(baseDir = env.UPLOAD_DIR) {
    this.baseDir = path.resolve(baseDir);
    fs.mkdirSync(this.baseDir, { recursive: true });

    this.isCloudinaryConfigured = Boolean(
      env.CLOUDINARY_CLOUD_NAME &&
      env.CLOUDINARY_API_KEY &&
      env.CLOUDINARY_API_SECRET
    );

    if (this.isCloudinaryConfigured) {
      cloudinary.config({
        cloud_name: env.CLOUDINARY_CLOUD_NAME,
        api_key: env.CLOUDINARY_API_KEY,
        api_secret: env.CLOUDINARY_API_SECRET,
        secure: env.CLOUDINARY_SECURE !== false
      });
      logger.info(`[Storage] Cloudinary initialized for cloud: ${env.CLOUDINARY_CLOUD_NAME}`);
    } else if (env.STORAGE_PROVIDER === 'cloudinary') {
      logger.warn('[Storage] STORAGE_PROVIDER="cloudinary" but credentials in .env are unpopulated. Operating with private local storage fallback.');
    }
  }

  _safeSubDir(subDir = 'general') {
    return String(subDir)
      .split(/[\\/]+/)
      .map(seg => seg.replace(/[^a-zA-Z0-9_-]/g, ''))
      .filter(Boolean)
      .join('/') || 'general';
  }

  /** Resolve a stored relative path to an absolute one, refusing anything outside the storage root. */
  getFilePath(relativePath) {
    if (typeof relativePath !== 'string' || relativePath.length === 0) {
      throw new AppError('Invalid file path', 400, 'INVALID_PATH');
    }
    const absolute = path.resolve(this.baseDir, relativePath);
    const rel = path.relative(this.baseDir, absolute);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      throw new AppError('Access denied: path traversal attempt', 403, 'PATH_TRAVERSAL');
    }
    return absolute;
  }

  async saveFile({ buffer, originalName = 'file', mimeType, subDir = 'general' }) {
    const safeFolder = this._safeSubDir(subDir);
    const targetDir = path.join(this.baseDir, safeFolder);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const ext = MIME_EXTENSIONS[mimeType] || '.bin';
    const uniqueFileId = uuidv4();
    const uniqueFileName = `${uniqueFileId}${ext}`;
    const fullPath = path.join(targetDir, uniqueFileName);
    const checksum = crypto.createHash('sha256').update(buffer).digest('hex');

    // Save to local storage cache so file streaming and email attachments always succeed
    await fs.promises.writeFile(fullPath, buffer, { flag: 'wx' });

    let cloudinaryData = null;
    if (env.STORAGE_PROVIDER === 'cloudinary' && this.isCloudinaryConfigured) {
      try {
        cloudinaryData = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: `tmt/${safeFolder}`,
              public_id: uniqueFileId,
              resource_type: 'auto'
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          uploadStream.end(buffer);
        });
        logger.info(`[Storage] Cloudinary upload successful: ${cloudinaryData.secure_url}`);
      } catch (err) {
        logger.error(`[Storage] Cloudinary upload encountered error (local fallback preserved): ${err.message}`);
      }
    }

    return {
      fileName: uniqueFileName,
      originalName: path.basename(String(originalName)).slice(0, 255),
      filePath: path.relative(this.baseDir, fullPath).replace(/\\/g, '/'),
      fullPath,
      cloudinaryUrl: cloudinaryData?.secure_url || null,
      cloudinaryPublicId: cloudinaryData?.public_id || null,
      mimeType,
      size: buffer.length,
      checksum
    };
  }

  async exists(relativePath) {
    try {
      await fs.promises.access(this.getFilePath(relativePath));
      return true;
    } catch {
      return false;
    }
  }

  async deleteFile(relativePath) {
    try {
      const absolute = this.getFilePath(relativePath);
      await fs.promises.unlink(absolute).catch(err => { if (err.code !== 'ENOENT') throw err; });
    } catch {}

    if (env.STORAGE_PROVIDER === 'cloudinary' && this.isCloudinaryConfigured) {
      try {
        const parsed = path.parse(relativePath);
        const publicId = `tmt/${this._safeSubDir(parsed.dir)}/${parsed.name}`;
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' }).catch(() => {});
        await cloudinary.uploader.destroy(publicId, { resource_type: 'image' }).catch(() => {});
      } catch (err) {
        logger.warn(`[Storage] Cloudinary asset deletion notice: ${err.message}`);
      }
    }
  }
}

export const storageService = new StorageService();
