import type { NextFunction, Request, Response } from 'express'
import type { Role } from '../generated/prisma/client.js'
import { ForbiddenError, UnauthorizedError } from '../common/errors/app-error.js'

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new UnauthorizedError()
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError()
    }

    next()
  }
}
