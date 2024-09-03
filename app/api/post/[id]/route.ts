import postService from '../service'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)
  const post = await postService.getPost(id)
  return Response.json({ code: 200, data: post, msg: 'success' })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)
  const post = await request.json()
  postService.editPost(id, post)
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)
  postService.deletePost(id)
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}
