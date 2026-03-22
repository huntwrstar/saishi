'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function UserMenu() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const userData = data.user
      setUser(userData)
      setIsAdmin(userData?.app_metadata?.role === 'admin')
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userData = session?.user ?? null
      setUser(userData)
      setIsAdmin(userData?.app_metadata?.role === 'admin')
    })

    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const linkStyle = {
    color: '#4b5563',
    textDecoration: 'none',
    fontSize: '0.75rem',          // 修改：从 0.875rem 缩小到 0.75rem
    transition: 'color 0.2s',
    whiteSpace: 'nowrap',         // 新增：链接不换行
  }

  const buttonStyle = {
    backgroundColor: '#f3f4f6',
    border: 'none',
    padding: '0.25rem 0.5rem',    // 修改：左右内边距从 0.75rem 缩小到 0.5rem
    borderRadius: '0.375rem',
    fontSize: '0.75rem',          // 修改：从 0.875rem 缩小到 0.75rem
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap',         // 新增：按钮文字不换行
  }

  const loginButtonStyle = {
    backgroundColor: '#3b82f6',
    color: '#ffffff',
    padding: '0.25rem 0.5rem',    // 修改：左右内边距缩小
    borderRadius: '0.375rem',
    fontSize: '0.75rem',          // 修改：字体缩小
    textDecoration: 'none',
    transition: 'background-color 0.2s',
    whiteSpace: 'nowrap',         // 新增：按钮文字不换行
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'nowrap' }}> {/* 新增 flexWrap: nowrap */}
      {user ? (
        <>
          <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
            欢迎，{user.user_metadata?.username || user.email}
          </span>
          <Link href="/profile" style={linkStyle}>
            个人中心
          </Link>
          {isAdmin && (
            <Link href="/admin" style={linkStyle}>
              后台管理
            </Link>
          )}
          <button
            onClick={handleLogout}
            style={buttonStyle}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#e5e7eb')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#f3f4f6')}
          >
            退出
          </button>
        </>
      ) : (
        <Link
          href="/auth/login"
          style={loginButtonStyle}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        >
          登录/注册
        </Link>
      )}
    </div>
  )
}