import postService from './service'

export async function PUT(request: Request) {
  const post = await request.json()
  postService.createPost(post)
  return Response.json({ code: 200, data: null, msg: 'success' })
}
