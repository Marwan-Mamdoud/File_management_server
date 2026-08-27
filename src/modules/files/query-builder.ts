import { z } from 'zod'
import type { Prisma } from '../../generated/prisma/client.js'

// ── Pagination primitives (reusable by every list endpoint, brief rule 9) ──

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
})

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function buildPaginationMeta(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

// ── Files list query ────────────────────────────────────────────────────────

const fileListQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(255).optional(),
  // Exact mime ('application/pdf') or family ('image', 'image/*').
  type: z.string().trim().min(1).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  minSize: z.coerce.number().int().min(0).optional(),
  maxSize: z.coerce.number().int().min(0).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'size', 'filename', 'mimeType']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  // Optional owner filter — used by admin listAllFiles to narrow by userId.
  userId: z.uuid().optional(),
})

export const fileListQuerySchemaWithRanges = fileListQuerySchema
  .refine((query) => query.from === undefined || query.to === undefined || query.from <= query.to, {
    message: "'from' must be before or equal to 'to'",
    path: ['from'],
  })
  .refine((query) => query.minSize === undefined || query.maxSize === undefined || query.minSize <= query.maxSize, {
    message: "'minSize' must be less than or equal to 'maxSize'",
    path: ['minSize'],
  })

export type FileListQuery = z.infer<typeof fileListQuerySchemaWithRanges>

export function parseFileListQuery(rawQuery: unknown): FileListQuery {
  return fileListQuerySchemaWithRanges.parse(rawQuery)
}

export function buildFileListWhere(query: FileListQuery, scopedUserId?: string): Prisma.FileWhereInput {
  const where: Prisma.FileWhereInput = {}

  if (scopedUserId !== undefined) {
    where.uploadedById = scopedUserId
  }

  if (query.search !== undefined) {
    where.filename = { contains: query.search, mode: 'insensitive' }
  }

  if (query.type !== undefined) {
    const familyOrMime = query.type.replace(/\/\*$/, '')
    where.mimeType = familyOrMime.includes('/')
      ? { equals: familyOrMime }
      : { startsWith: `${familyOrMime}/` }
  }

  if (query.from !== undefined || query.to !== undefined) {
    where.createdAt = {
      ...(query.from !== undefined && { gte: query.from }),
      ...(query.to !== undefined && { lte: query.to }),
    }
  }

  if (query.minSize !== undefined || query.maxSize !== undefined) {
    where.size = {
      ...(query.minSize !== undefined && { gte: query.minSize }),
      ...(query.maxSize !== undefined && { lte: query.maxSize }),
    }
  }

  return where
}

export function buildFileListOrder(query: FileListQuery): Prisma.FileOrderByWithRelationInput {
  return { [query.sortBy]: query.order } as Prisma.FileOrderByWithRelationInput
}
