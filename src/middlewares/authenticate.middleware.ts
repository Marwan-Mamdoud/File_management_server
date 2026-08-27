import type { NextFunction, Request, Response } from 'express'
import { UnauthorizedError } from '../common/errors/app-error.js'
import { verifyAccessToken } from '../common/utils/jwt.util.js'

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined

  if (!token) {
    throw new UnauthorizedError()
  }

  try {
    req.user = verifyAccessToken(token)
  } catch {
    throw new UnauthorizedError('Invalid or expired session')
  }

  next()
}
