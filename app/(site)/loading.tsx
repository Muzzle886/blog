import { ListSkeleton, SectionLabel } from '@/components/ui'

export default function Loading() {
  return (
    <div className="shell">
      <div className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>载入中</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <div className="skeleton h-9 w-40" />
          </div>
        </div>
      </div>
      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <ListSkeleton rows={4} />
        </div>
      </div>
    </div>
  )
}
