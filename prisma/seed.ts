import bcrypt from 'bcrypt'
import { Role } from '../src/generated/prisma/client.js'
import { prisma } from '../src/config/db.js'
import { env } from '../src/config/env.js'

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email: env.ADMIN_EMAIL },
    select: { id: true },
  })

  if (existing) {
    console.log(`Admin ${env.ADMIN_EMAIL} already exists — skipping seed`)
    return
  }

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12)

  await prisma.user.create({
    data: {
      name: env.ADMIN_NAME,
      email: env.ADMIN_EMAIL,
      password: passwordHash,
      role: Role.ADMIN,
      isVerified: true,
    },
  })

  console.log(`Admin ${env.ADMIN_EMAIL} created`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
