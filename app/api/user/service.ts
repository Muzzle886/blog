import prisma from '@/lib/prisma'

const userService = {
  async login(username: string, password: string) {
    const user = await prisma.user.findFirst({ where: { username } })
    if (user) {
      if (user.password === password) {
        return user
      } else {
        throw new Error('username or password wrong')
      }
    } else {
      throw new Error('no exist user')
    }
  },
  async register(username: string, password: string, name: string) {
    const preUser = await prisma.user.findFirst({ where: { username } })
    if (preUser) {
      throw new Error('user exist')
    } else {
      await prisma.user.create({ data: { username, password, name } })
    }
  },
}

export default userService
