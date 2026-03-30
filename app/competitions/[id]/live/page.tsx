'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'

const ROUNDS = [
  { value: 1, label: '初赛' },
  { value: 2, label: '复赛' },
  { value: 3, label: '半决赛' },
  { value: 4, label: '决赛' },
]

const STATUS_MAP: Record<string, string> = {
  not_started: '未开始',
  in_progress: '进行中',
  finished: '已结束',
}

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

interface Option {
  eventId: number
  eventName: string
  round: number
  roundLabel: string
  status: string
  statusLabel: string
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('成绩直播')

  useEffect(() => {
    const unwrapParams = async () => {
      const { id } = await params
      setCompetitionId(id)
    }
    unwrapParams()
  }, [params])

  // 加载赛事信息、项目列表、轮次状态，构建下拉选项
  useEffect(() => {
    if (!competitionId) return
    const fetchData = async () => {
      // 获取赛事
      const { data: comp } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()
      setCompetition(comp)
      setTitle(comp?.is_finished ? '赛果' : '成绩直播')

      // 获取项目列表
      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .eq('competition_id', competitionId)

      if (!evts || evts.length === 0) {
        setLoading(false)
        return
      }

      // 构建选项列表
      const opts: Option[] = []
      for (const event of evts) {
        const rounds = event.rounds || [1,2,3,4]
        const statusMap = event.rounds_status || {}
        for (const round of rounds) {
          const status = statusMap[round] || 'not_started'
          opts.push({
            eventId: event.id,
            eventName: event.name,
            round,
            roundLabel: ROUNDS.find(r => r.value === round)?.label || `第${round}轮`,
            status,
            statusLabel: STATUS_MAP[status],
          })
        }
      }
      setOptions(opts)

      // 默认选中第一个有成绩或状态为“进行中”的选项
      let defaultOption = opts.find(opt => opt.status === 'in_progress')
      if (!defaultOption && opts.length) defaultOption = opts[0]
      if (defaultOption) {
        setSelectedOption(defaultOption)
        await loadRankings(defaultOption)
      }
      setLoading(false)
    }

    const loadRankings = async (option: Option) => {
      // 获取报名记录
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
        .eq('event_id', option.eventId)
        .eq('status', 'registered')
        .order('created_at', { ascending: true })

      if (!registrations || registrations.length === 0) {
        setRankings([])
        return
      }

      // 获取选手信息
      const userIds = [...new Set(registrations.map(r => r.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, site_id')
        .in('id', userIds)
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      // 计算报名序号
      const userOrder = new Map()
      for (const reg of registrations) {
        if (!userOrder.has(reg.user_id)) {
          userOrder.set(reg.user_id, userOrder.size + 1)
        }
      }

      // 获取成绩
      const regIds = registrations.map(r => r.id)
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .in('registration_id', regIds)
        .eq('round', option.round)

      const resultsByReg = new Map()
      results?.forEach(r => resultsByReg.set(r.registration_id, r))

      // 构建成绩组（支持团队）
      const groupMap = new Map<string, any>()
      for (const reg of registrations) {
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
      setRankings(ranked)
    }

    fetchData()
  }, [competitionId])

  const handleOptionChange = async (optionKey: string) => {
    const opt = options.find(o => `${o.eventId}_${o.round}` === optionKey)
    if (!opt) return
    setSelectedOption(opt)

    // 获取报名记录
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
      .eq('event_id', opt.eventId)
      .eq('status', 'registered')
      .order('created_at', { ascending: true })

    if (!registrations || registrations.length === 0) {
      setRankings([])
      return
    }

    // 获取选手信息
    const userIds = [...new Set(registrations.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, site_id')
      .in('id', userIds)
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const userOrder = new Map()
    for (const reg of registrations) {
      if (!userOrder.has(reg.user_id)) {
        userOrder.set(reg.user_id, userOrder.size + 1)
      }
    }

    const regIds = registrations.map(r => r.id)
    const { data: results } = await supabase
      .from('results')
      .select('*')
      .in('registration_id', regIds)
      .eq('round', opt.round)

    const resultsByReg = new Map()
    results?.forEach(r => resultsByReg.set(r.registration_id, r))

    const groupMap = new Map<string, any>()
    for (const reg of registrations) {
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
    setRankings(ranked)
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div className="text-center py-8">加载中...</div>
  if (!competition) return <div className="text-center text-red-500 py-8">赛事不存在</div>

  return (
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">{title} - {competition.name}</h1>

      <div className="mb-6">
        <label className="form-label">选择项目与轮次：</label>
        <select
          className="form-select w-full md:w-auto"
          value={selectedOption ? `${selectedOption.eventId}_${selectedOption.round}` : ''}
          onChange={(e) => handleOptionChange(e.target.value)}
        >
          <option value="">-- 请选择 --</option>
          {options.map(opt => (
            <option key={`${opt.eventId}_${opt.round}`} value={`${opt.eventId}_${opt.round}`}>
              {opt.eventName} - {opt.roundLabel} ({opt.statusLabel})
            </option>
          ))}
        </select>
      </div>

      {selectedOption && (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h2 className="text-lg font-semibold">
              {selectedOption.eventName} - {selectedOption.roundLabel} <span className="text-sm font-normal text-gray-500">({selectedOption.statusLabel})</span>
            </h2>
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
                    const orderSet = new Set<number>(group.users.map((u: any) => u.order))
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
      )}

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