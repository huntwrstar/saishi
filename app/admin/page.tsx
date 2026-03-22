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

  if (loading) return <div className="text-center py-8">加载中...</div>

  if (!isAdmin) {
    return <div className="text-center text-red-500 py-8">您没有权限访问此页面</div>
  }

  return (
    <div className="container py-8">
      <div className="card p-6">
        <h1 className="text-xl font-bold mb-6">后台管理</h1>
        <ul className="space-y-3">
          <li>
            <Link href="/admin/competitions" className="btn btn-primary">
              管理赛事
            </Link>
          </li>
          <li>
            <Link href="/admin/competitions/new" className="btn btn-primary">
              创建新赛事
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}