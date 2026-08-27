import { Router } from 'express'
import multer from 'multer'
import { authenticate } from '../../middlewares/authenticate.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as filesController from './files.controller.js'
import { renameDto } from './files.dto.js'

// Memory storage only — never diskStorage. The per-request SIZE cap is
// enforced in the service (batch total ≤ MAX_TOTAL_UPLOAD_BYTES) so one
// oversized member can't abort the whole multipart parse the way multer's
// per-part fileSize limit would.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 10 },
})

export const filesRoutes = Router()

filesRoutes.post('/upload', authenticate, upload.array('files', 10), filesController.upload)
filesRoutes.get('/', authenticate, filesController.list)
filesRoutes.get('/:id', authenticate, filesController.getById)
filesRoutes.patch('/:id', authenticate, validate(renameDto), filesController.rename)
filesRoutes.delete('/:id', authenticate, filesController.remove)
