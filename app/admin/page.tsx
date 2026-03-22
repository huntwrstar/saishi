'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminPage() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const user = data.user
      setIsAdmin(user?.app_metadata?.role === 'admin')
      setLoading(false)
    })
  }, [])

  if (loading) return <div>加载中...</div>

  if (!isAdmin) {
    return <div>您没有权限访问此页面</div>
  }

  return (
    <div style={{ padding: '2rem' }}>
      <h1>后台管理</h1>
      <ul>
        <li><Link href="/admin/competitions">管理赛事</Link></li>
        <li><Link href="/admin/competitions/new">创建新赛事</Link></li>
      </ul>
    </div>
  )
}