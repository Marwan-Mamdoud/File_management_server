import { prisma } from '../../config/db.js'

const HISTORY_DAYS = 14

export interface FileTypeStat {
  mimeType: string
  count: number
  storageBytes: number
}

export interface UploadHistoryEntry {
  date: string
  count: number
}

export interface UserStats {
  totals: { files: number; storageBytes: number }
  fileTypes: FileTypeStat[]
  uploadHistory: UploadHistoryEntry[]
}

export interface AdminStats {
  totals: { users: number; files: number; storageBytes: number }
  mostUploadedTypes: FileTypeStat[]
  recentUploads: Array<{
    id: string
    filename: string
    mimeType: string
    size: number
    createdAt: Date
    uploader: { id: string; name: string; email: string }
  }>
}

interface GroupRow {
  mimeType: string
  _count: { _all: number }
  _sum: { size: number | null }
}

function toFileTypeStats(groups: GroupRow[]): FileTypeStat[] {
  return groups.map((group) => ({
    mimeType: group.mimeType,
    count: group._count._all,
    storageBytes: group._sum.size ?? 0,
  }))
}

// UTC-noon anchors make seeded/bucketed dates deterministic regardless of run time.
function utcNoonAt(dayOffset: number): Date {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + dayOffset)
  date.setUTCHours(12, 0, 0, 0)
  return date
}

export async function getUserStats(userId: string): Promise<UserStats> {
  // Assumption (brief-approved): the daily upload history uses one raw SQL
  // aggregation because Prisma groupBy cannot DATE_TRUNC — still read-only,
  // computed on demand per brief rule 10.
  const windowStart = utcNoonAt(-(HISTORY_DAYS - 1))
  windowStart.setUTCHours(0, 0, 0, 0)

  const [fileAggregate, typeGroups, historyRows] = await Promise.all([
    prisma.file.aggregate({
      where: { uploadedById: userId },
      _count: { _all: true },
      _sum: { size: true },
    }),
    prisma.file.groupBy({
      by: ['mimeType'],
      where: { uploadedById: userId },
      _count: { _all: true },
      _sum: { size: true },
    }),
    prisma.$queryRaw<Array<{ day: Date; count: number }>>`
      SELECT DATE_TRUNC('day', "createdAt") AS day, COUNT(*)::int AS count
      FROM "File"
      WHERE "uploadedById" = ${userId} AND "createdAt" >= ${windowStart}
      GROUP BY day
      ORDER BY day ASC
    `,
  ])

  const countsByDay = new Map(
    historyRows.map((row) => [row.day.toISOString().slice(0, 10), Number(row.count)]),
  )

  const uploadHistory: UploadHistoryEntry[] = []
  for (let offset = HISTORY_DAYS - 1; offset >= 0; offset--) {
    const date = utcNoonAt(-offset)
    uploadHistory.push({
      date: date.toISOString().slice(0, 10),
      count: countsByDay.get(date.toISOString().slice(0, 10)) ?? 0,
    })
  }

  return {
    totals: {
      files: fileAggregate._count._all,
      storageBytes: fileAggregate._sum.size ?? 0,
    },
    fileTypes: toFileTypeStats(typeGroups),
    uploadHistory,
  }
}

export async function getAdminStats(): Promise<AdminStats> {
  const [userCount, fileAggregate, typeGroups, recentUploads] = await Promise.all([
    prisma.user.count(),
    prisma.file.aggregate({
      _count: { _all: true },
      _sum: { size: true },
    }),
    prisma.file.groupBy({
      by: ['mimeType'],
      _count: { _all: true },
      _sum: { size: true },
      orderBy: { _count: { mimeType: 'desc' } },
      take: 5,
    }),
    prisma.file.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        filename: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    }),
  ])

  return {
    totals: {
      users: userCount,
      files: fileAggregate._count._all,
      storageBytes: fileAggregate._sum.size ?? 0,
    },
    mostUploadedTypes: toFileTypeStats(typeGroups),
    recentUploads: recentUploads.map(({ uploadedBy, ...file }) => ({
      ...file,
      uploader: uploadedBy,
    })),
  }
}
