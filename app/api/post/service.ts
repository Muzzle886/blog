import prisma from '@/lib/prisma'
import { Post } from '@prisma/client'

const postService = {
  async getPost(id: number) {
    return await prisma.post.findFirst({ where: { id } })
  },
  async editPost(id: number, post: Omit<Omit<Post, 'id'>, 'authorId'>) {
    await prisma.post.update({ data: post, where: { id } })
  },
  async createPost(post: Omit<Post, 'id'>) {
    await prisma.post.create({
      data: {
        title: post.title,
        content: post.content,
        authorId: post.authorId,
      },
    })
  },
  async deletePost(id: number) {
    await prisma.post.delete({ where: { id } })
  },
}

export default postService
