import userService from '../service'

export async function POST(request: Request) {
  const { username, password, name } = await request.json()
  try {
    const user = await userService.register(username, password, name)
    return Response.json({ user })
  } catch (error: any) {
    return Response.json({ msg: error.message })
  }
}
