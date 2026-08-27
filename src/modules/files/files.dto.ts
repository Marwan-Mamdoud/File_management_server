import { z } from 'zod'

export const renameDto = z.object({
  filename: z.string().trim().min(1, 'Filename is required').max(255),
})

export type RenameInput = z.infer<typeof renameDto>
