import type { Request, Response } from 'express'
import { ValidationError } from '../../common/errors/app-error.js'
import { parseFileListQuery } from './query-builder.js'
import * as filesService from './files.service.js'

export async function upload(req: Request, res: Response): Promise<void> {
  const files = (req.files ?? []) as Express.Multer.File[]

  if (files.length === 0) {
    throw new ValidationError('At least one file is required (multipart field "files")')
  }

  const outcome = await filesService.uploadFiles(
    files.map((file) => ({
      buffer: file.buffer,
      originalname: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    })),
    req.user!.userId,
  )

  res.status(outcome.status).json({
    message: outcome.message,
    summary: outcome.summary,
    results: outcome.results,
  })
}

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseFileListQuery(req.query)
  const result = await filesService.listFiles(query, req.user!)
  res.json(result)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const file = await filesService.getFileById(req.params.id as string, req.user!)
  res.json({ file })
}

export async function rename(req: Request, res: Response): Promise<void> {
  const { filename } = req.body as { filename: string }
  const file = await filesService.renameFile(req.params.id as string, req.user!, filename)
  res.json({ message: 'File renamed successfully', file })
}

export async function remove(req: Request, res: Response): Promise<void> {
  await filesService.deleteFile(req.params.id as string, req.user!)
  res.json({ message: 'File deleted successfully' })
}
