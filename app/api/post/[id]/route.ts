export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  return Response.json({ code: 200, data: params.id, msg: 'success' })
}
