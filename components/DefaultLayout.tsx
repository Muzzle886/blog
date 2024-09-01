import Header from '@/components/Header'
import Footer from '@/components/Footer'

export default function DefaultLayout({
  search = true,
  children,
}: {
  search?: boolean
  children: React.ReactNode
}) {
  return (
    <>
      <Header search={search}></Header>
      <div className="w-[1200px] mx-auto">{children}</div>
      <Footer></Footer>
    </>
  )
}
