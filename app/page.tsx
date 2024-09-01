import { Button, Divider, Space } from 'antd'
import { CommentOutlined, LikeOutlined, StarOutlined } from '@ant-design/icons'
import Link from 'next/link'
import DefaultLayout from '@/components/DefaultLayout'

export default function Home() {
  return (
    <DefaultLayout>
      <div className="my-4 flex gap-4">
        <div className="bg-white shadow p-4 flex-grow">
          <div className="flex flex-col gap-2">
            <Link href="/post/1" className="font-bold">
              Article title
            </Link>
            <div className="text-gray-300">
              <Link href="/post/1">asdfjasdf;</Link>
            </div>
            <div className="text-gray-500 text-sm flex items-center">
              <div className="flex gap-1">
                <LikeOutlined />
                <span>100</span>
              </div>
              <Divider type="vertical" />
              <div className="flex gap-1">
                <StarOutlined />
                <span>100</span>
              </div>
              <Divider type="vertical" />
              <div className="flex gap-1">
                <CommentOutlined />
                <span>100</span>
              </div>
            </div>
          </div>
          <Divider />
        </div>
        <div className="w-48">
          <div className="bg-white shadow p-4 mb-4"></div>
          <Button type="primary" size="large" className="w-full">
            发布文章
          </Button>
        </div>
      </div>
    </DefaultLayout>
  )
}
