import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.middleware.js'
import { authorize } from '../../middlewares/authorize.middleware.js'
import { validate } from '../../middlewares/validate.middleware.js'
import * as usersController from './users.controller.js'
import { updateUserDto } from './users.dto.js'

export const usersRoutes = Router()

// Every admin route uses both middlewares (brief rule 6).
usersRoutes.get('/', authenticate, authorize('ADMIN'), usersController.list)
usersRoutes.patch('/:id', authenticate, authorize('ADMIN'), validate(updateUserDto), usersController.update)
usersRoutes.delete('/:id', authenticate, authorize('ADMIN'), usersController.remove)
