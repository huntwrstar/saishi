'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'

// 时间格式化函数（处理 null）
const formatTime = (seconds: number | null): string => {
  if (seconds === null || isNaN(seconds)) return '-'
  if (seconds < 60) return seconds.toFixed(2)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = (seconds % 60).toFixed(2)
  if (minutes < 60) return `${minutes}:${remainingSeconds.padStart(5, '0')}`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return `${hours}:${remainingMinutes.toString().padStart(2, '0')}:${remainingSeconds.padStart(5, '0')}`
}

interface GroupUser {
  user_id: string
  username: string
  site_id: string
  order: number
}

interface Group {
  users: GroupUser[]
  average: number | null
  best: number | null
  attemptData: string[]
  rank?: number | null
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [rankingsMap, setRankingsMap] = useState<Record<number, Group[]>>({})
  const [loading, setLoading] = useState(true)
  const eventRefs = useRef<Record<number, HTMLDivElement | null>>({})

  useEffect(() => {
    const unwrapParams = async () => {
      const { id } = await params
      setCompetitionId(id)
    }
    unwrapParams()
  }, [params])

  useEffect(() => {
    if (!competitionId) return

    const fetchData = async () => {
      // 1. 获取赛事基本信息
      const { data: comp } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()
      setCompetition(comp)

      // 2. 获取项目列表
      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .eq('competition_id', competitionId)
      setEvents(evts || [])
      if (!evts || evts.length === 0) {
        setLoading(false)
        return
      }

      // 3. 获取所有报名记录（不含 profiles 信息，避免类型问题）
      const { data: registrations } = await supabase
        .from('registrations')
        .select(`
          id,
          user_id,
          event_id,
          status,
          created_at
        `)
        .eq('competition_id', competitionId)
        .eq('status', 'registered')
        .order('created_at', { ascending: true })

      if (!registrations || registrations.length === 0) {
        setRankingsMap({})
        setLoading(false)
        return
      }

      // 4. 获取选手信息（单独查询 profiles）
      const userIds = [...new Set(registrations.map(r => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, site_id')
        .in('id', userIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // 5. 计算每个用户的报名序号
      const userOrder = new Map<string, number>()
      for (const reg of registrations) {
        if (!userOrder.has(reg.user_id)) {
          userOrder.set(reg.user_id, userOrder.size + 1)
        }
      }

      // 6. 获取所有成绩
      const regIds = registrations.map(r => r.id)
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .in('registration_id', regIds)

      // 成绩按 registration_id 映射，保留最新的一条
      const resultsByReg = new Map()
      results?.forEach(r => {
        const existing = resultsByReg.get(r.registration_id)
        if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
          resultsByReg.set(r.registration_id, r)
        }
      })

      // 7. 按项目构建成绩组
      const projectRankings: Record<number, Group[]> = {}
      for (const event of evts) {
        const eventRegs = registrations.filter(r => r.event_id === event.id)

        const groupMap = new Map<string, Group>()
        for (const reg of eventRegs) {
          const result = resultsByReg.get(reg.id)
          const groupId = result?.group_id || `single-${reg.id}`
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              users: [],
              average: result?.average ?? null,
              best: result?.best ?? null,
              attemptData: result?.attempt_data ?? [],
            })
          }
          const group = groupMap.get(groupId)!
          const profile = profileMap.get(reg.user_id)
          if (profile && !group.users.some(u => u.user_id === reg.user_id)) {
            group.users.push({
              user_id: reg.user_id,
              username: profile.username,
              site_id: profile.site_id,
              order: userOrder.get(reg.user_id)!,
            })
          }
        }

        // 转换为数组并排序
        let groups = Array.from(groupMap.values())
        groups.sort((a, b) => {
          if (a.average === null && b.average === null) return 0
          if (a.average === null) return 1
          if (b.average === null) return -1
          if (a.average === b.average) return (a.best || 0) - (b.best || 0)
          return (a.average || 0) - (b.average || 0)
        })

        // 添加排名
        let rank = 1
        const ranked = groups.map(item => ({
          ...item,
          rank: item.average !== null ? rank++ : null,
        }))
        projectRankings[event.id] = ranked
      }

      setRankingsMap(projectRankings)
      setLoading(false)
    }

    fetchData()
  }, [competitionId])

  const scrollToEvent = (eventId: number) => {
    eventRefs.current[eventId]?.scrollIntoView({ behavior: 'smooth' })
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="text-center py-8">加载中...</div>
  if (!competition) return <div className="text-center text-red-500 py-8">赛事不存在</div>

  const title = competition.is_finished ? '赛果' : '成绩直播'

  return (
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">{title} - {competition.name}</h1>

      <select className="form-select mb-6 w-auto" onChange={(e) => scrollToEvent(Number(e.target.value))}>
        <option value="">跳转到项目</option>
        {events.map(event => (
          <option key={event.id} value={event.id}>{event.name}</option>
        ))}
      </select>

      {events.map(event => {
        const rankings = rankingsMap[event.id] || []
        return (
          <div key={event.id} className="card mb-8" ref={el => { eventRefs.current[event.id] = el }}>
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold">{event.name}</h2>
            </div>
            {rankings.length === 0 ? (
              <div className="p-4 text-gray-500 text-center">暂无报名选手</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>NO.</th>
                      <th>选手</th>
                      <th>平均</th>
                      <th>最好</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((group, idx) => {
                      // 报名序号去重排序
                      const orderSet = new Set(group.users.map(u => u.order))
                      const orderNumbers = Array.from(orderSet).sort((a, b) => a - b).join(',')
                      const usernames = group.users.map(u => u.username).join(', ')
                      return (
                        <tr key={idx}>
                          <td>{group.rank ? group.rank : '-'}</td>
                          <td>{orderNumbers}</td>
                          <td>{usernames}</td>
                          <td>{formatTime(group.average)}</td>
                          <td>{formatTime(group.best)}</td>
                          <td>{group.attemptData.length ? group.attemptData.join(', ') : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )
      })}

      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
        }}
        className="btn btn-primary rounded-full p-3 shadow-lg"
        aria-label="回到顶部"
      >
        ↑
      </button>
    </div>
  )
}