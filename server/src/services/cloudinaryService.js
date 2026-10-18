import { cloudinaryEnabled, signUploadParams, destroyImage, UPLOAD_FOLDER } from '../config/cloudinary.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Server-generated, signed upload authorization for Cloudinary.
 * Validates purpose/size server-side; credentials never reach the client.
 */

const ALLOWED_PURPOSES = {
  avatar: { folder: `${UPLOAD_FOLDER}/avatars`, maxBytes: 1024 * 1024 },
  quizCover: { folder: `${UPLOAD_FOLDER}/quiz-covers`, maxBytes: 2 * 1024 * 1024 },
  pollCover: { folder: `${UPLOAD_FOLDER}/poll-covers`, maxBytes: 2 * 1024 * 1024 },
};

export function getSignedUpload({ purpose = 'avatar' }) {
  if (!cloudinaryEnabled()) {
    throw ApiError.badRequest('Image uploads are not configured on this deployment', 'UPLOADS_DISABLED');
  }
  const preset = ALLOWED_PURPOSES[purpose];
  if (!preset) throw ApiError.badRequest('Unknown upload purpose', 'INVALID_PURPOSE');

  return {
    ...signUploadParams({ folder: preset.folder, maxBytes: preset.maxBytes }),
    purpose,
    allowedFormats: ['jpg', 'jpeg', 'png', 'webp', 'gif'],
  };
}

/**
 * Only the owner of an image (or an admin) may delete/replace it. Verified by
 * comparing the public id embedded in the resource they own.
 */
export function assertImageOwnership({ resourceImage, candidatePublicId, isAdmin = false }) {
  if (isAdmin) return;
  if (!resourceImage?.publicId || resourceImage.publicId !== candidatePublicId) {
    throw ApiError.forbidden('You can only manage images that belong to your content', 'IMAGE_FORBIDDEN');
  }
}

export async function removeImage(publicId) {
  return destroyImage(publicId);
}

export default { getSignedUpload, assertImageOwnership, removeImage, cloudinaryEnabled };
