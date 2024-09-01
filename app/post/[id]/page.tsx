import { sanitize } from '@/lib/domPurify'
import { Divider } from 'antd'
import { marked } from 'marked'
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: "Article Title | Muzzle's blog",
}

export default function Post({ params }: { params: { id: string } }) {
  const markdownText = `
  # title1
  \`\`\`js
  let a = 1;
  \`\`\`
  <script>alert(1)</script>
  `
  return (
    <div className="w-[1200px] mx-auto bg-white shadow my-4 p-4">
      <div className="text-3xl font-bold">post {params.id}</div>
      <div className="mt-2">author: Muzzle</div>
      <Divider />
      <article
        dangerouslySetInnerHTML={{
          __html: sanitize(marked.parse(markdownText, { async: false })),
        }}
      ></article>
    </div>
  )
}
