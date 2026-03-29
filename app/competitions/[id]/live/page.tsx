'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useRef, useState } from 'react'

const ROUNDS = [
  { value: 1, label: '初赛' },
  { value: 2, label: '复赛' },
  { value: 3, label: '半决赛' },
  { value: 4, label: '决赛' },
]

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

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [rankingsMap, setRankingsMap] = useState<Record<number, any[]>>({})
  const [loading, setLoading] = useState(true)
  const [selectedRound, setSelectedRound] = useState<number>(1)
  const [availableRounds, setAvailableRounds] = useState<number[]>([])
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
      // 获取赛事信息
      const { data: comp } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()
      setCompetition(comp)

      // 获取项目列表
      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .eq('competition_id', competitionId)
      setEvents(evts || [])
      if (!evts || evts.length === 0) {
        setLoading(false)
        return
      }

      // 获取所有报名记录（按报名时间排序）
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

      // 获取选手信息
      const userIds = [...new Set(registrations.map(r => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, site_id')
        .in('id', userIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // 计算每个用户的报名序号
      const userOrder = new Map()
      for (const reg of registrations) {
        if (!userOrder.has(reg.user_id)) {
          userOrder.set(reg.user_id, userOrder.size + 1)
        }
      }

      // 获取所有成绩（仅用于获取有哪些轮次）
      const allRegIds = registrations.map(r => r.id)
      const { data: allResults } = await supabase
        .from('results')
        .select('round')
        .in('registration_id', allRegIds)
      const roundsSet = new Set(allResults?.map(r => r.round) || [])
      const rounds = Array.from(roundsSet).sort((a, b) => a - b)
      setAvailableRounds(rounds)
      if (rounds.length > 0 && !rounds.includes(selectedRound)) {
        setSelectedRound(rounds[0])
      }

      // 获取当前轮次的成绩
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .in('registration_id', allRegIds)
        .eq('round', selectedRound)

      const resultsByReg = new Map()
      results?.forEach(r => {
        const existing = resultsByReg.get(r.registration_id)
        if (!existing || new Date(r.created_at) > new Date(existing.created_at)) {
          resultsByReg.set(r.registration_id, r)
        }
      })

      // 按项目构建成绩组
      const projectRankings: Record<number, any[]> = {}
      for (const event of evts) {
        const eventRegs = registrations.filter(r => r.event_id === event.id)

        const groupMap = new Map<string, any>()
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
          const group = groupMap.get(groupId)
          const profile = profileMap.get(reg.user_id)
          if (profile && !group.users.some((u: any) => u.user_id === reg.user_id)) {
            group.users.push({
              user_id: reg.user_id,
              username: profile.username,
              site_id: profile.site_id,
              order: userOrder.get(reg.user_id),
            })
          }
        }

        let groups = Array.from(groupMap.values())
        groups.sort((a, b) => {
          if (a.average === null && b.average === null) return 0
          if (a.average === null) return 1
          if (b.average === null) return -1
          if (a.average === b.average) return (a.best || 0) - (b.best || 0)
          return (a.average || 0) - (b.average || 0)
        })

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
  }, [competitionId, selectedRound])

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

      {/* 轮次选择器 */}
      {availableRounds.length > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm font-medium">轮次：</span>
          <select
            className="form-select w-auto"
            value={selectedRound}
            onChange={e => setSelectedRound(parseInt(e.target.value))}
          >
            {availableRounds.map(round => {
              const roundLabel = ROUNDS.find(r => r.value === round)?.label || `第${round}轮`
              return <option key={round} value={round}>{roundLabel}</option>
            })}
          </select>
        </div>
      )}

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
              <div className="p-4 text-gray-500 text-center">暂无成绩</div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>排名</th>
                      <th>报名序号</th>
                      <th>选手</th>
                      <th>平均</th>
                      <th>最好</th>
                      <th>详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.map((group, idx) => {
                      const orderSet = new Set(group.users.map((u: any) => u.order))
                      const orderNumbers = Array.from(orderSet).sort((a, b) => a - b).join(',')
                      const usernames = group.users.map((u: any) => u.username).join(', ')
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