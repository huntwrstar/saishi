'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function TestPage() {
  const [session, setSession] = useState<any>(null)
  const [localStorageData, setLocalStorageData] = useState<Record<string, any>>({})

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      console.log('客户端 session:', data.session)
    })

    // 打印所有 localStorage 中与 supabase 相关的键
    const supabaseKeys = Object.keys(localStorage).filter(key => key.startsWith('sb-'))
    const data: Record<string, any> = {}
    supabaseKeys.forEach(key => {
      data[key] = localStorage.getItem(key)
    })
    setLocalStorageData(data)
  }, [])

  return (
    <div style={{ padding: '2rem' }}>
      <h2>客户端 session</h2>
      <pre>{JSON.stringify(session, null, 2)}</pre>
      <h2>localStorage 中 Supabase 相关数据</h2>
      <pre>{JSON.stringify(localStorageData, null, 2)}</pre>
      <button onClick={() => window.location.reload()}>刷新页面</button>
    </div>
  )
}