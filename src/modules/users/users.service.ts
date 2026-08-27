import { prisma } from '../../config/db.js'
import { Role } from '../../generated/prisma/client.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { ConflictError, ForbiddenError, NotFoundError } from '../../common/errors/app-error.js'
import type { AccessTokenPayload } from '../../common/utils/jwt.util.js'
import { publicUserSelect, type PublicUser } from '../auth/auth.service.js'
import { destroyFromCloudinary } from '../files/upload.service.js'
import { buildPaginationMeta, type PaginationMeta } from '../files/query-builder.js'
import type { UpdateUserInput, UsersListQuery } from './users.dto.js'

export interface UsersListResult {
  data: PublicUser[]
  pagination: PaginationMeta
}

function buildUsersListWhere(query: UsersListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}

  if (query.search !== undefined) {
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { email: { contains: query.search, mode: 'insensitive' } },
    ]
  }

  if (query.role !== undefined) {
    where.role = query.role
  }

  if (query.isVerified !== undefined) {
    where.isVerified = query.isVerified
  }

  if (query.from !== undefined || query.to !== undefined) {
    where.createdAt = {
      ...(query.from !== undefined && { gte: query.from }),
      ...(query.to !== undefined && { lte: query.to }),
    }
  }

  return where
}

export async function listUsers(query: UsersListQuery): Promise<UsersListResult> {
  const where = buildUsersListWhere(query)

  const [total, data] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { [query.sortBy]: query.order } as Prisma.UserOrderByWithRelationInput,
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: publicUserSelect,
    }),
  ])

  return { data, pagination: buildPaginationMeta(query.page, query.limit, total) }
}

// Count of other admins — used for last-admin protection on demote/delete.
function countOtherAdmins(excludedUserId: string): Promise<number> {
  return prisma.user.count({ where: { role: Role.ADMIN, id: { not: excludedUserId } } })
}

export async function updateUser(id: string, requester: AccessTokenPayload, input: UpdateUserInput): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, select: publicUserSelect })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  if (input.role !== undefined && input.role !== user.role && id === requester.userId) {
    throw new ForbiddenError('You cannot change your own role')
  }

  if (input.role === Role.USER && user.role === Role.ADMIN) {
    if ((await countOtherAdmins(id)) === 0) {
      throw new ConflictError('Cannot demote the last remaining admin')
    }
  }

  return prisma.user.update({
    where: { id },
    data: input,
    select: publicUserSelect,
  })
}

export async function deleteUser(id: string, requester: AccessTokenPayload): Promise<void> {
  if (id === requester.userId) {
    throw new ForbiddenError('You cannot delete your own account')
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      role: true,
      files: { select: { storageKey: true, mimeType: true } },
    },
  })

  if (!user) {
    throw new NotFoundError('User not found')
  }

  if (user.role === Role.ADMIN && (await countOtherAdmins(id)) === 0) {
    throw new ConflictError('Cannot delete the last remaining admin')
  }

  // Schema cascades File + VerificationCode rows; storage cleanup is best-effort.
  await prisma.user.delete({ where: { id } })

  const cleanupResults = await Promise.allSettled(
    user.files.map((file) => destroyFromCloudinary(file.storageKey, file.mimeType)),
  )
  for (const result of cleanupResults) {
    if (result.status === 'rejected') {
      console.error('[warn] failed to destroy storage asset during user deletion:', result.reason)
    }
  }
}
