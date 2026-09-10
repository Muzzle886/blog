import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { postService } from '@/server/post-service'
import { MarkdownEditor } from '@/components/markdown-editor'

export const dynamic = 'force-dynamic'

interface EditPageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: EditPageProps): Promise<Metadata> {
  return { title: `编辑 · ${params.slug}` }
}

export default async function EditPostPage({ params }: EditPageProps) {
  const user = await getCurrentUser()
  if (!user) redirect(`/login?redirect=${encodeURIComponent(`/write/${params.slug}`)}`)

  try {
    // getForEdit 会校验作者身份，草稿也可读取
    const post = await postService.getForEdit(params.slug, user)
    return <MarkdownEditor post={post} />
  } catch (error) {
    if (error instanceof AppError && (error.status === 404 || error.status === 403)) notFound()
    throw error
  }
}
