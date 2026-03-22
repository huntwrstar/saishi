import AdminGuard from '@/components/AdminGuard'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <AdminGuard>
      <div style={{ padding: '2rem' }}>
        <nav style={{ marginBottom: '1rem' }}>
          <a href="/admin/competitions" style={{ marginRight: '1rem' }}>赛事管理</a>
          <a href="/">返回首页</a>
        </nav>
        {children}
      </div>
    </AdminGuard>
  )
}