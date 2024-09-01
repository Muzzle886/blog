import { UserOutlined } from '@ant-design/icons'
import { Button, Dropdown } from 'antd'
import Image from 'next/image'
import Link from 'next/link'
import PostSearch from './PostSearch'

export default function Header({ search = true }: { search?: boolean }) {
  return (
    <header className="bg-white shadow sticky top-0">
      <div className="w-[1200px] h-[50px] leading-[50px] mx-auto flex">
        <Link href="/" className="flex items-center gap-1" title="文章体">
          <Image src="/logo.svg" alt="logo" width={16} height={16} />
        </Link>
        <div className="ml-4 flex gap-2 flex-grow">
          <Link href="/" className="px-2 hover:bg-gray-100">
            首页
          </Link>
          <Link href="/" className="px-2 hover:bg-gray-100">
            归档
          </Link>
          <Link href="/" className="px-2 hover:bg-gray-100">
            标签
          </Link>
          <Link href="/" className="px-2 hover:bg-gray-100">
            关于
          </Link>
        </div>
        <div className="flex gap-2 items-center">
          {search && <PostSearch></PostSearch>}
          <Link href="/login">
            <Button autoInsertSpace={false}>登录</Button>
          </Link>
          <Button type="text" icon={<UserOutlined />}></Button>
        </div>
      </div>
    </header>
  )
}
