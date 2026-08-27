import type { Request, Response } from 'express'
import { parseFileListQuery } from './query-builder.js'
import * as filesService from './files.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseFileListQuery(req.query)
  const result = await filesService.listAllFiles(query)
  res.json(result)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const file = await filesService.getFileByIdAdmin(req.params.id as string)
  res.json({ file })
}

export async function rename(req: Request, res: Response): Promise<void> {
  const { filename } = req.body as { filename: string }
  const file = await filesService.renameFileAdmin(req.params.id as string, filename)
  res.json({ message: 'File renamed successfully', file })
}

export async function remove(req: Request, res: Response): Promise<void> {
  await filesService.deleteFileAdmin(req.params.id as string)
  res.json({ message: 'File deleted successfully' })
}
