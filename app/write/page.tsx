import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { MarkdownEditor } from '@/components/markdown-editor'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '写文章',
}

export default async function NewPostPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fwrite')

  return <MarkdownEditor />
}
