'use client'

import Search from 'antd/es/input/Search'
import useMessage from 'antd/es/message/useMessage'
import { useRouter } from 'next/navigation'

export default function PostSearch() {
  const [messageApi, messageContext] = useMessage()
  const router = useRouter()
  const handleSearch = (value: string) => {
    if (!value) {
      messageApi.error('请输入搜索关键词！')
    } else {
      router.push('/search?keyword=' + value.trim())
    }
  }
  return (
    <>
      {messageContext}
      <Search onSearch={handleSearch}></Search>
    </>
  )
}
