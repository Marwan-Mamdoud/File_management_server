import { prisma } from "../../config/db.js";
import { ExtractionStatus, Role } from "../../generated/prisma/client.js";
import type { Prisma } from "../../generated/prisma/client.js";
import {
  AppError,
  NotFoundError,
  ValidationError,
} from "../../common/errors/app-error.js";
import type { AccessTokenPayload } from "../../common/utils/jwt.util.js";
import { detectMimeType } from "../../common/utils/mime.util.js";
import { extractFile } from "./extraction/extraction.service.js";
import { uploadToCloudinary, destroyFromCloudinary } from "./upload.service.js";
import { publicUserSelect } from "../auth/auth.service.js";
import {
  buildFileListOrder,
  buildFileListWhere,
  buildPaginationMeta,
  type FileListQuery,
  type PaginationMeta,
} from "./query-builder.js";

// Brief rule 5a: allow-list enforced on the DERIVED mime type (and pre-checked
// on the claimed one as a cheap early filter). Legacy .doc intentionally absent.
export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const fileSelect = {
  id: true,
  filename: true,
  mimeType: true,
  size: true,
  url: true,
  storageKey: true,
  extractedContent: true,
  extractedMetadata: true,
  extractionStatus: true,
  uploadedById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.FileSelect

const fileSelectWithUser = {
  ...fileSelect,
  uploadedBy: { select: publicUserSelect },
} satisfies Prisma.FileSelect;

export type FileDto = Prisma.FileGetPayload<{ select: typeof fileSelect }>;

export interface UploadedFilePayload {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimeType: string;
}

export function sanitizeFilename(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 255) : "untitled";
}

async function uploadOne(
  file: UploadedFilePayload,
  userId: string,
): Promise<FileDto> {
  if (file.size === 0) {
    throw new ValidationError("File is empty");
  }

  const claimedMime = file.mimeType;

  if (!ALLOWED_MIME_TYPES.has(claimedMime)) {
    throw new ValidationError("File type not allowed");
  }

  const detected = await detectMimeType(file.buffer, claimedMime);

  if (!detected || !ALLOWED_MIME_TYPES.has(detected.mime)) {
    throw new ValidationError("File type not allowed");
  }

  // Both consumers only read the shared buffer — safe to parallelize (brief rule 5).
  // Extraction failure must NOT fail the request: the row is still persisted as FAILED.
  const [extraction, storage] = await Promise.all([
    extractFile(file.buffer, detected.mime).catch(
      (error: unknown) => error as Error,
    ),
    uploadToCloudinary(file.buffer, userId),
  ]);

  const extractionFailed = extraction instanceof Error;

  return prisma.file.create({
    data: {
      filename: sanitizeFilename(file.originalname),
      mimeType: detected.mime,
      size: file.size,
      url: storage.url,
      storageKey: storage.publicId,
      extractedContent: extraction instanceof Error ? null : extraction.content,
      extractedMetadata: {
        ...(extraction instanceof Error
          ? { error: extraction.message }
          : extraction.metadata),
        mimeDetectionMethod: detected.method,
      },
      extractionStatus: extractionFailed
        ? ExtractionStatus.FAILED
        : ExtractionStatus.COMPLETED,
      uploadedById: userId,
    },
    select: fileSelect,
  });
}

// ── Batch upload ────────────────────────────────────────────────────────────

// Aligned with Vercel's ~4.5MB serverless body cap so local behavior matches
// the deployed platform exactly. The cap applies to the WHOLE request.
export const MAX_TOTAL_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_FILES_PER_REQUEST = 10;

export interface SucceededFileResult {
  filename: string;
  success: true;
  file: FileDto;
}

export interface FailedFileResult {
  filename: string;
  success: false;
  error: { code: string; message: string };
}

export type FileUploadResult = SucceededFileResult | FailedFileResult;

export interface UploadFilesOutcome {
  status: number;
  message: string;
  summary: { total: number; uploaded: number; failed: number };
  results: FileUploadResult[];
}

function toErrorPayload(error: unknown): { code: string; message: string } {
  if (error instanceof AppError) {
    return { code: error.code, message: error.message };
  }
  console.error("[unhandled upload error]", error);
  return { code: "INTERNAL_SERVER_ERROR", message: "Something went wrong" };
}

// Each file is processed independently — one failure never blocks the rest.
// The whole-batch size guard runs first (mirrors Vercel's request-body cap).
export async function uploadFiles(
  files: UploadedFilePayload[],
  userId: string,
): Promise<UploadFilesOutcome> {
  if (files.length === 0) {
    throw new ValidationError(
      'At least one file is required (multipart field "files")',
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
    throw new ValidationError(
      "Total size of all uploaded files exceeds the maximum allowed request size",
    );
  }

  const attempts = await Promise.all(
    files.map(
      async (
        file,
      ): Promise<{ result: FileUploadResult; statusCode: number }> => {
        try {
          const dto = await uploadOne(file, userId);
          return {
            result: { filename: file.originalname, success: true, file: dto },
            statusCode: 201,
          };
        } catch (error) {
          return {
            result: {
              filename: file.originalname,
              success: false,
              error: toErrorPayload(error),
            },
            statusCode: error instanceof AppError ? error.statusCode : 500,
          };
        }
      },
    ),
  );

  const results = attempts.map((attempt) => attempt.result);
  const uploaded = results.filter((result) => result.success).length;
  const failed = results.length - uploaded;

  const allSucceeded = uploaded === results.length;
  const status = allSucceeded
    ? 201
    : uploaded > 0
      ? 207
      : attempts.every((a) => a.statusCode < 500)
        ? 400
        : 502;

  return {
    status,
    message: allSucceeded
      ? `All ${results.length} file(s) uploaded successfully`
      : `Uploaded ${uploaded} of ${results.length} files`,
    summary: { total: results.length, uploaded, failed },
    results,
  };
}

export interface FileListResult {
  data: FileDto[];
  pagination: PaginationMeta;
}

// Regular users see only their own uploads; admin override moved to
// listAllFiles (files-admin.routes).
export async function listFiles(
  query: FileListQuery,
  requester: AccessTokenPayload,
): Promise<FileListResult> {
  const scopedUserId = requester.userId;

  const where = buildFileListWhere(query, scopedUserId);

  const [total, data] = await prisma.$transaction([
    prisma.file.count({ where }),
    prisma.file.findMany({
      where,
      orderBy: buildFileListOrder(query),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: fileSelect,
    }),
  ]);

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  };
}

// Returns null for missing files AND files the requester may not see —
// non-owners get an indistinguishable 404 (anti-enumeration).
async function findAccessibleFile(
  id: string,
  requester: AccessTokenPayload,
): Promise<FileDto | null> {
  const file = await prisma.file.findUnique({
    where: { id },
    select: fileSelect,
  });

  if (!file) {
    return null;
  }

  if (file.uploadedById !== requester.userId && requester.role !== Role.ADMIN) {
    return null;
  }

  return file;
}

export async function getFileById(
  id: string,
  requester: AccessTokenPayload,
): Promise<FileDto> {
  const file = await findAccessibleFile(id, requester);

  if (!file) {
    throw new NotFoundError("File not found");
  }

  return file;
}

export async function renameFile(
  id: string,
  requester: AccessTokenPayload,
  filename: string,
): Promise<FileDto> {
  const file = await findAccessibleFile(id, requester);

  if (!file) {
    throw new NotFoundError("File not found");
  }

  return prisma.file.update({
    where: { id },
    data: { filename: sanitizeFilename(filename) },
    select: fileSelect,
  });
}

export async function deleteFile(
  id: string,
  requester: AccessTokenPayload,
): Promise<void> {
  const file = await findAccessibleFile(id, requester);

  if (!file) {
    throw new NotFoundError("File not found");
  }

  await prisma.file.delete({ where: { id } });

  // DB row is authoritative; storage cleanup is best-effort so a Cloudinary
  // hiccup never fails an already-committed deletion.
  try {
    await destroyFromCloudinary(file.storageKey, file.mimeType);
  } catch (error) {
    console.error(
      `[warn] failed to destroy storage asset ${file.storageKey}:`,
      error,
    );
  }
}

// ── Admin: full access to every file ────────────────────────────────────────

// Admin list — every file includes uploadedBy; optional userId narrows to one user.
export async function listAllFiles(
  query: FileListQuery,
): Promise<FileListResult> {
  const scopedUserId = query.userId;
  const where = buildFileListWhere(query, scopedUserId);

  const [total, data] = await prisma.$transaction([
    prisma.file.count({ where }),
    prisma.file.findMany({
      where,
      orderBy: buildFileListOrder(query),
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: fileSelectWithUser,
    }),
  ])

  return {
    data,
    pagination: buildPaginationMeta(query.page, query.limit, total),
  }
}

export async function getFileByIdAdmin(id: string): Promise<FileDto> {
  const file = await prisma.file.findUnique({
    where: { id },
    select: fileSelectWithUser,
  });

  if (!file) {
    throw new NotFoundError("File not found");
  }

  return file;
}

export async function renameFileAdmin(
  id: string,
  filename: string,
): Promise<FileDto> {
  const file = await prisma.file.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!file) {
    throw new NotFoundError("File not found");
  }

  return prisma.file.update({
    where: { id },
    data: { filename: sanitizeFilename(filename) },
    select: fileSelectWithUser,
  })
}

export async function deleteFileAdmin(id: string): Promise<void> {
  const file = await prisma.file.findUnique({
    where: { id },
    select: { storageKey: true, mimeType: true },
  });

  if (!file) {
    throw new NotFoundError("File not found");
  }

  await prisma.file.delete({ where: { id } });

  try {
    await destroyFromCloudinary(file.storageKey, file.mimeType);
  } catch (error) {
    console.error(
      `[warn] failed to destroy storage asset ${file.storageKey}:`,
      error,
    );
  }
}
