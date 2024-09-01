import DefaultLayout from '@/components/DefaultLayout'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DefaultLayout search={false}>{children}</DefaultLayout>
}
