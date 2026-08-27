import type { Request, Response } from 'express'
import * as statsService from './stats.service.js'

export async function userStats(req: Request, res: Response): Promise<void> {
  const stats = await statsService.getUserStats(req.user!.userId)
  res.json(stats)
}

export async function adminStats(_req: Request, res: Response): Promise<void> {
  const stats = await statsService.getAdminStats()
  res.json(stats)
}
