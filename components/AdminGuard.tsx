'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.app_metadata?.role === 'admin') {
        setIsAdmin(true)
      } else {
        setIsAdmin(false)
        router.push('/') // 非管理员重定向到首页
      }
    })
  }, [router])

  if (isAdmin === null) return <div>验证权限中...</div>
  if (!isAdmin) return null
  return <>{children}</>
}