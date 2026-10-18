import { v2 as cloudinary } from 'cloudinary';
import config from './env.js';

/**
 * Cloudinary is optional: text-only quizzes and polls work without it.
 * Credentials live exclusively on the server.
 */
export function configureCloudinary() {
  if (!config.cloudinary.configured) return false;
  cloudinary.config({
    cloud_name: config.cloudinary.cloudName,
    api_key: config.cloudinary.apiKey,
    api_secret: config.cloudinary.apiSecret,
    secure: true,
  });
  return true;
}

export const cloudinaryEnabled = () => config.cloudinary.configured;

export const UPLOAD_FOLDER = 'quizsphere';

/**
 * Generate signed upload parameters for the client-side uploader.
 * The client never sees the API secret.
 */
export function signUploadParams({ folder = UPLOAD_FOLDER, maxBytes = 2 * 1024 * 1024 } = {}) {
  const timestamp = Math.round(Date.now() / 1000);
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder, max_bytes: maxBytes },
    config.cloudinary.apiSecret
  );
  return {
    timestamp,
    folder,
    maxBytes,
    signature,
    apiKey: config.cloudinary.apiKey,
    cloudName: config.cloudinary.cloudName,
  };
}

/** Delete an image by public id (best-effort, ignores missing assets). */
export async function destroyImage(publicId) {
  if (!cloudinaryEnabled() || !publicId) return { result: 'skipped' };
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch {
    return { result: 'error' };
  }
}

export default cloudinary;
