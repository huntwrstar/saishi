import './globals.css'
import Link from 'next/link'
import UserMenu from '@/components/UserMenu'

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh">
      <body style={{ margin: 0, backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        <header
          style={{
            backgroundColor: '#ffffff',
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div
            style={{
              maxWidth: '1280px',
              margin: '0 auto',
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Link
              href="/"
              style={{
                fontSize: '1.25rem',
                fontWeight: 'bold',
                color: '#1f2937',
                textDecoration: 'none',
                letterSpacing: '-0.025em',
              }}
            >
              鹅城魔方赛事网
            </Link>
            <UserMenu />
          </div>
        </header>
        <main>{children}</main>
      </body>
    </html>
  )
}