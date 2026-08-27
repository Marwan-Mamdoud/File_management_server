import jwt from 'jsonwebtoken'
import { env } from '../../config/env.js'
import type { Role } from '../../generated/prisma/client.js'

// JWT payload carries identity/authorization data only — no PII (per brief).
export interface AccessTokenPayload {
  userId: string
  role: Role
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  })
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, env.JWT_SECRET)

  if (typeof decoded !== 'object' || decoded === null) {
    throw new Error('Malformed token payload')
  }

  const { userId, role } = decoded as Record<string, unknown>

  if (typeof userId !== 'string' || userId.length === 0) {
    throw new Error('Invalid token subject')
  }

  if (role !== 'USER' && role !== 'ADMIN') {
    throw new Error('Invalid token role')
  }

  return { userId, role }
}
