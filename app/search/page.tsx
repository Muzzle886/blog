'use client'

import { HomeOutlined } from '@ant-design/icons'
import { Breadcrumb, Tabs, TabsProps } from 'antd'
import Search from 'antd/es/input/Search'
import { useSearchParams } from 'next/navigation'
import { ChangeEventHandler, useState } from 'react'

const tabsItems: TabsProps['items'] = [
  { key: 'title', label: '标题', children: 'Search Title' },
  { key: 'content', label: '正文', children: 'Search Content' },
]

export default function SearchPage() {
  const searchParams = useSearchParams()
  const keyword = searchParams.get('keyword') ?? ''
  const [searchValue, setSearchValue] = useState(keyword)
  const handleSearchChange: ChangeEventHandler<HTMLInputElement> = event => {
    setSearchValue(event.target.value)
  }
  return (
    <div className="w-[1200px] mx-auto mt-4 p-4 bg-white shadow rounded">
      <Breadcrumb
        items={[{ title: <HomeOutlined />, href: '/' }, { title: '搜索' }]}
      ></Breadcrumb>
      <Search
        value={searchValue}
        onChange={handleSearchChange}
        className="mt-4"
      ></Search>
      <Tabs items={tabsItems} size="small"></Tabs>
    </div>
  )
}
