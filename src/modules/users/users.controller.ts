import type { Request, Response } from 'express'
import { parseUsersListQuery } from './users.dto.js'
import * as usersService from './users.service.js'

export async function list(req: Request, res: Response): Promise<void> {
  const query = parseUsersListQuery(req.query)
  const result = await usersService.listUsers(query)
  res.json(result)
}

export async function update(req: Request, res: Response): Promise<void> {
  const userId = req.params.id as string
  const user = await usersService.updateUser(userId, req.user!, req.body)
  res.json({ message: 'User updated successfully', user })
}

export async function remove(req: Request, res: Response): Promise<void> {
  const userId = req.params.id as string
  await usersService.deleteUser(userId, req.user!)
  res.json({ message: 'User deleted successfully' })
}
