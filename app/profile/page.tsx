'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { formatDate } from '@/lib/format'

// 轮次名称映射
const ROUND_NAMES: Record<number, string> = {
  1: '初赛',
  2: '复赛',
  3: '半决赛',
  4: '决赛',
}

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [siteId, setSiteId] = useState<string>('')
  const [registrations, setRegistrations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
  document.title = '个人中心 - 鹅城魔方赛事网'
}, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
      if (user) {
        // 获取网站ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('site_id')
          .eq('id', user.id)
          .single()
        if (profile) setSiteId(profile.site_id)

        // 获取报名记录（含赛事、项目信息）
        const { data: regs } = await supabase
          .from('registrations')
          .select(`
            id,
            status,
            competitions!inner (id, name, datetime),
            events!inner (id, name, calculation_rule)
          `)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
        if (regs) {
          // 为每个报名记录获取各轮成绩
          const regWithResults = await Promise.all(regs.map(async (reg) => {
            const { data: results } = await supabase
              .from('results')
              .select('round, average, best, attempt_data')
              .eq('registration_id', reg.id)
              .order('round', { ascending: true })
            return { ...reg, results: results || [] }
          }))
          setRegistrations(regWithResults)
        }
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) return <div className="text-center py-8">加载中...</div>
  if (!user) return <div className="text-center text-red-500 py-8">请先登录</div>

  // 按赛事分组
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
      id: reg.id,
      name: reg.events.name,
      rule: reg.events.calculation_rule,
      status: reg.status,
      results: reg.results,
    })
  })

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">个人中心</h1>
          <div className="space-y-2 text-gray-700">
            <p>用户名：{user.user_metadata?.username || user.email}</p>
            <p>网站ID：{siteId || '未生成'}</p>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-800 mb-4">参赛记录</h2>
        {Object.values(grouped).length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">暂无报名记录</div>
        ) : (
          <div className="space-y-6">
            {Object.values(grouped).map(({ competition, events }) => (
              <div key={competition.id} className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-gray-800">{competition.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">时间：{formatDate(competition.datetime)}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">项目</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">成绩</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {events.map((ev, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{ev.name}</td>
                          <td className="px-4 py-3 text-sm">
                            {ev.status === 'withdrawn' ? (
                              <span className="text-red-600">已退赛</span>
                            ) : (
                              <span className="text-green-600">已报名</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {ev.results && ev.results.length > 0 ? (
                              <div className="space-y-1">
                                {ev.results.map((res: any) => {
                                  const roundName = ROUND_NAMES[res.round] || `第${res.round}轮`
                                  return (
                                    <div key={res.round}>
                                      <span className="font-medium">{roundName}：</span>
                                      平均 {res.average.toFixed(2)} / 最好 {res.best.toFixed(2)}
                                      <br />
                                      <span className="text-xs text-gray-500">详情：{res.attempt_data.join(', ')}</span>
                                    </div>
                                  )
                                })}
                              </div>
                            ) : (
                              <span className="text-gray-400">暂无成绩</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}