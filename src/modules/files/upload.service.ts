import { cloudinary } from '../../config/cloudinary.config.js'
import { AppError } from '../../common/errors/app-error.js'

const CLOUDINARY_ROOT_FOLDER = 'file-management'

export interface CloudinaryUploadResult {
  url: string
  publicId: string
}

// Memory-buffer upload via upload_stream — the filesystem is never touched
// (deployment target has an ephemeral/read-only disk, per brief).
export function uploadToCloudinary(buffer: Buffer, userId: string): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'auto',
        folder: `${CLOUDINARY_ROOT_FOLDER}/${userId}`,
      },
      (error, result) => {
        if (error) {
          reject(new AppError(502, 'UPLOAD_FAILED', `Cloud storage upload failed`))
          return
        }

        if (!result) {
          reject(new AppError(502, 'UPLOAD_FAILED', 'Cloud storage returned no result'))
          return
        }

        resolve({ url: result.secure_url, publicId: result.public_id })
      },
    )

    stream.end(buffer)
  })
}

// auto storage maps images AND pdfs to resource_type 'image'; everything else
// lands as 'raw' — deletion must target the matching type.
export async function destroyFromCloudinary(publicId: string, mimeType: string): Promise<void> {
  const resourceType = mimeType.startsWith('image/') || mimeType === 'application/pdf' ? 'image' : 'raw'
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType })
}
