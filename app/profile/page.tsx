'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [siteId, setSiteId] = useState<string>('')
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('site_id').eq('id', user.id).single()
        if (profile) setSiteId(profile.site_id)

        const { data: regs } = await supabase
          .from('registrations')
          .select(`
            id,
            status,
            competitions!inner (id, name, datetime),
            events!inner (id, name),
            results!left (average, best, attempt_data)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        setRegistrations(regs || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="container py-8 text-center">加载中...</div>
  if (!user) return <div className="container py-8 text-center text-red-500">请先登录</div>

  const grouped: Record<number, { competition: any, events: any[] }> = {}
  registrations.forEach(reg => {
    const compId = reg.competitions.id
    if (!grouped[compId]) {
      grouped[compId] = {
        competition: reg.competitions,
        events: []
      }
    }
    grouped[compId].events.push({
      name: reg.events.name,
      status: reg.status,
      result: reg.results?.[0] || null
    })
  })

  return (
    <div className="container py-8">
      <div className="card p-6 mb-8">
        <h1 className="text-xl font-bold mb-4">个人中心</h1>
        <p className="mb-2">用户名：{user.user_metadata?.username || user.email}</p>
        <p>网站ID：{siteId || '未生成'}</p>
      </div>

      <h2 className="text-lg font-semibold mb-4">参赛记录</h2>
      {Object.values(grouped).length === 0 ? (
        <div className="card p-6 text-center text-gray-500">暂无报名记录</div>
      ) : (
        Object.values(grouped).map(({ competition, events }) => (
          <div key={competition.id} className="card mb-6 overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold">{competition.name}</h3>
              <p className="text-sm text-gray-500">时间：{new Date(competition.datetime).toLocaleDateString()}</p>
            </div>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>项目</th>
                    <th>状态</th>
                    <th>成绩</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev, idx) => (
                    <tr key={idx}>
                      <td>{ev.name}</td>
                      <td className={ev.status === 'withdrawn' ? 'status-withdrawn' : 'status-registered'}>
                        {ev.status === 'withdrawn' ? '已退赛' : '已报名'}
                      </td>
                      <td>
                        {ev.result ? (
                          <>平均 {ev.result.average.toFixed(2)} / 最好 {ev.result.best.toFixed(2)}<br />
                          <span className="text-sm text-gray-500">详情：{ev.result.attempt_data.join(', ')}</span></>
                        ) : '暂无成绩'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}