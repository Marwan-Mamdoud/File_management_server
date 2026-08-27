import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.middleware.js'
import { authorize } from '../../middlewares/authorize.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as filesAdminController from './files-admin.controller.js'
import { renameDto } from './files.dto.js'

export const filesAdminRoutes = Router()

filesAdminRoutes.get('/all', authenticate, authorize('ADMIN'), filesAdminController.list)
filesAdminRoutes.get('/:id', authenticate, authorize('ADMIN'), filesAdminController.getById)
filesAdminRoutes.patch('/:id', authenticate, authorize('ADMIN'), validate(renameDto), filesAdminController.rename)
filesAdminRoutes.delete('/:id', authenticate, authorize('ADMIN'), filesAdminController.remove)
