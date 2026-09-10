import { ListSkeleton } from '@/components/ui'

/** 列表页的加载占位，避免布局跳动 */
export default function Loading() {
  return (
    <div className="container-page py-10">
      <div className="mb-10">
        <div className="skeleton h-7 w-32" />
        <div className="skeleton mt-3 h-4 w-72" />
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}
