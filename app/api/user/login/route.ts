import userService from '../service'

export async function POST(request: Request) {
  const { username, password } = await request.json()
  try {
    const user = await userService.login(username, password)
    return Response.json({ user })
  } catch (error: any) {
    return Response.json({ msg: error.message })
  }
}
