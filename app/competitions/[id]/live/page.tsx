'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

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

const FIXED_EVENTS_ORDER = [
  '三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲',
  '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲',
]

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

interface RankGroup {
  users: {
    user_id: string
    username: string
    site_id: string
    order: number
  }[]
  average: number | null
  best: number | null
  attemptData: string[]
  rank: number | null
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [rankings, setRankings] = useState<RankGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('成绩直播')
  const [regToGroupIndex, setRegToGroupIndex] = useState<Map<number, number>>(new Map())
  const timeoutRefs = useRef<Map<number, NodeJS.Timeout>>(new Map())

  // 排名总和相关状态
  const [showRankSumModal, setShowRankSumModal] = useState(false)
  const [allEvents, setAllEvents] = useState<any[]>([])
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([])
  const [rankSumResult, setRankSumResult] = useState<any[]>([])
  const [calculating, setCalculating] = useState(false)

  // 设置页面标题
  useEffect(() => {
    if (competition) {
      document.title = `成绩直播 - ${competition.name} - 赛事平台`
    }
  }, [competition])

  // 加载排名的核心函数
  const loadRankings = async (option: Option): Promise<Map<number, number>> => {
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, user_id, event_id, status, created_at')
      .eq('competition_id', competitionId)
      .eq('event_id', option.eventId)
      .eq('status', 'registered')
      .order('created_at', { ascending: true })

    if (!registrations || registrations.length === 0) {
      setRankings([])
      setRegToGroupIndex(new Map())
      return new Map()
    }

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
      .eq('round', option.round)

    const resultsByReg = new Map()
    results?.forEach(r => resultsByReg.set(r.registration_id, r))

    const groupMap = new Map<string, { group: RankGroup; regIds: number[] }>()
    for (const reg of registrations) {
      const result = resultsByReg.get(reg.id)
      const groupId = result?.group_id || `single-${reg.id}`
      if (!groupMap.has(groupId)) {
        groupMap.set(groupId, {
          group: {
            users: [],
            average: result?.average ?? null,
            best: result?.best ?? null,
            attemptData: result?.attempt_data ?? [],
            rank: null,
          },
          regIds: [],
        })
      }
      const entry = groupMap.get(groupId)!
      const profile = profileMap.get(reg.user_id)
      if (profile && !entry.group.users.some(u => u.user_id === reg.user_id)) {
        entry.group.users.push({
          user_id: reg.user_id,
          username: profile.username,
          site_id: profile.site_id,
          order: userOrder.get(reg.user_id),
        })
      }
      entry.regIds.push(reg.id)
    }

    const groups = Array.from(groupMap.values())
    groups.sort((a, b) => {
      const avgA = a.group.average ?? Infinity
      const avgB = b.group.average ?? Infinity
      if (avgA === avgB) return (a.group.best ?? Infinity) - (b.group.best ?? Infinity)
      return avgA - avgB
    })

    let rank = 1
    const finalRanked: RankGroup[] = []
    const newRegToGroup = new Map<number, number>()
    for (let idx = 0; idx < groups.length; idx++) {
      const { group, regIds } = groups[idx]
      const rankedGroup = {
        ...group,
        rank: group.average !== null ? rank++ : null,
      }
      finalRanked.push(rankedGroup)
      for (const regId of regIds) {
        newRegToGroup.set(regId, idx)
      }
    }

    setRankings(finalRanked)
    setRegToGroupIndex(newRegToGroup)
    return newRegToGroup
  }

  // 初始化数据
  useEffect(() => {
    const unwrapParams = async () => {
      const { id } = await params
      setCompetitionId(id)
    }
    unwrapParams()
  }, [params])

  useEffect(() => {
    if (!competitionId) return

    const fetchInitialData = async () => {
      const { data: comp } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()
      setCompetition(comp)
      setTitle(comp?.is_finished ? '赛果' : '成绩直播')

      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .eq('competition_id', competitionId)

      if (!evts || evts.length === 0) {
        setLoading(false)
        return
      }

      // 保存所有项目（用于排名总和）
      setAllEvents(evts)

      const sortedEvents = [...evts].sort((a, b) => {
        const aIndex = FIXED_EVENTS_ORDER.indexOf(a.name)
        const bIndex = FIXED_EVENTS_ORDER.indexOf(b.name)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
        if (aIndex !== -1) return -1
        if (bIndex !== -1) return 1
        return a.id - b.id
      })

      const opts: Option[] = []
      for (const event of sortedEvents) {
        const rounds = event.rounds || [1, 2, 3, 4]
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

      let defaultOption = opts.find(opt => opt.status === 'in_progress')
      if (!defaultOption && opts.length) defaultOption = opts[0]
      if (defaultOption) {
        setSelectedOption(defaultOption)
        await loadRankings(defaultOption)
      }
      setLoading(false)
    }

    fetchInitialData()
  }, [competitionId])

  // 实时订阅：成绩变更 + 轮次状态变更
  useEffect(() => {
    if (!competitionId || !selectedOption) return

    const resultsChannel = supabase
      .channel('results-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'results' },
        async (payload) => {
          await loadRankings(selectedOption)
          let registrationId: number | null = null
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            registrationId = payload.new.registration_id
          } else if (payload.eventType === 'DELETE') {
            registrationId = payload.old.registration_id
          }
          if (registrationId) {
            setTimeout(() => {
              const idx = regToGroupIndex.get(registrationId)
              if (idx !== undefined) {
                const row = document.querySelector(`tr[data-group-idx="${idx}"]`) as HTMLElement
                if (row) {
                  if (timeoutRefs.current.has(registrationId)) {
                    clearTimeout(timeoutRefs.current.get(registrationId)!)
                  }
                  row.classList.add('highlight-flash')
                  const timeout = setTimeout(() => {
                    row.classList.remove('highlight-flash')
                    timeoutRefs.current.delete(registrationId)
                  }, 3000)
                  timeoutRefs.current.set(registrationId, timeout)
                }
              }
            }, 100)
          }
        }
      )
      .subscribe()

    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        async (payload) => {
          const updatedEvent = payload.new
          const newRoundsStatus = updatedEvent.rounds_status || {}
          setOptions(prev => prev.map(opt => {
            if (opt.eventId === updatedEvent.id) {
              const newStatus = newRoundsStatus[opt.round] || 'not_started'
              return { ...opt, status: newStatus, statusLabel: STATUS_MAP[newStatus] }
            }
            return opt
          }))
          if (selectedOption && selectedOption.eventId === updatedEvent.id) {
            const newStatus = newRoundsStatus[selectedOption.round] || 'not_started'
            if (newStatus !== selectedOption.status) {
              setSelectedOption(prev => prev ? { ...prev, status: newStatus, statusLabel: STATUS_MAP[newStatus] } : null)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(resultsChannel)
      supabase.removeChannel(eventsChannel)
    }
  }, [competitionId, selectedOption, regToGroupIndex])

  const handleOptionChange = async (optionKey: string) => {
    const opt = options.find(o => `${o.eventId}_${o.round}` === optionKey)
    if (!opt) return
    setSelectedOption(opt)
    await loadRankings(opt)
  }

  // 计算排名总和
  const calculateRankSum = async () => {
    if (selectedEventIds.length === 0) {
      alert('请至少选择一个项目')
      return
    }
    setCalculating(true)
    // 获取所有报名选手（所有项目）
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, user_id')
      .eq('competition_id', competitionId)
      .eq('status', 'registered')
    if (!registrations || registrations.length === 0) {
      alert('暂无报名选手')
      setCalculating(false)
      return
    }
    const userIds = [...new Set(registrations.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, site_id')
      .in('id', userIds)
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    // 为每个选手初始化总分和项目排名映射
    const playerScore: Record<string, { total: number; details: Record<number, number | null> }> = {}
    for (const userId of userIds) {
      playerScore[userId] = { total: 0, details: {} }
    }

    // 对每个选中的项目，获取该项目的最终轮次（取最大值）的排名
    for (const eventId of selectedEventIds) {
      const event = allEvents.find(e => e.id === eventId)
      if (!event) continue
      const finalRound = Math.max(...(event.rounds || [1,2,3,4]))
      // 获取该项目该轮次的排名
      const { data: eventRegistrations } = await supabase
        .from('registrations')
        .select('id, user_id')
        .eq('competition_id', competitionId)
        .eq('event_id', eventId)
        .eq('status', 'registered')
      if (!eventRegistrations || eventRegistrations.length === 0) continue
      const regIds = eventRegistrations.map(r => r.id)
      const { data: results } = await supabase
        .from('results')
        .select('registration_id, average')
        .in('registration_id', regIds)
        .eq('round', finalRound)
      // 构建成绩映射，然后排序得到排名
      const regToAvg = new Map<number, number>()
      results?.forEach(r => regToAvg.set(r.registration_id, r.average))
      const regWithAvg = eventRegistrations.filter(reg => regToAvg.has(reg.id))
      regWithAvg.sort((a, b) => (regToAvg.get(a.id) || Infinity) - (regToAvg.get(b.id) || Infinity))
      // 分配排名
      let rank = 1
      for (const reg of regWithAvg) {
        const userId = reg.user_id
        const rankValue = rank++
        playerScore[userId].total += rankValue
        playerScore[userId].details[eventId] = rankValue
      }
      // 没有成绩的选手不分配排名（细节中不显示）
    }

    // 转换为数组并排序（总分越小排名越好）
    const resultArray = Object.entries(playerScore).map(([userId, data]) => ({
      userId,
      username: profileMap.get(userId)?.username || '未知',
      siteId: profileMap.get(userId)?.site_id || '未知',
      total: data.total,
      details: data.details,
    }))
    resultArray.sort((a, b) => a.total - b.total)
    setRankSumResult(resultArray)
    setCalculating(false)
  }

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>加载中...</div>
  if (!competition) return <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>赛事不存在</div>

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/competitions/${competition.id}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← 返回赛事详情
        </Link>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{title} - {competition.name}</h1>
        <button
          onClick={() => setShowRankSumModal(true)}
          style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
        >
          排名总和
        </button>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>选择项目与轮次：</label>
        <select
          style={{
            width: '100%',
            maxWidth: '300px',
            padding: '0.5rem 0.75rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.375rem',
            fontSize: '0.875rem',
          }}
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
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>
              {selectedOption.eventName} - {selectedOption.roundLabel}{' '}
              <span style={{ fontSize: '0.875rem', fontWeight: 'normal', color: '#6b7280' }}>({selectedOption.statusLabel})</span>
            </h2>
          </div>
          {rankings.length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>暂无成绩</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>排名</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>报名序号</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>选手</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>平均</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>最好</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>详情</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((group, idx) => {
                    const orderSet = new Set<number>(group.users.map(u => u.order))
                    const orderNumbers = Array.from(orderSet).sort((a, b) => a - b).join(',')
                    const usernames = group.users.map(u => u.username).join(', ')
                    return (
                      <tr
                        key={idx}
                        data-group-idx={idx}
                        style={{ borderBottom: '1px solid #e5e7eb' }}
                      >
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{group.rank ? group.rank : '-'}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{orderNumbers}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{usernames}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(group.average)}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(group.best)}</td>
                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{group.attemptData.length ? group.attemptData.join(', ') : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 排名总和模态框 */}
      {showRankSumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">排名总和计算</h2>
              <button onClick={() => setShowRankSumModal(false)} className="text-gray-500 hover:text-gray-700">×</button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择项目（多选）</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {allEvents.map(event => (
                  <label key={event.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      value={event.id}
                      checked={selectedEventIds.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEventIds([...selectedEventIds, event.id])
                        } else {
                          setSelectedEventIds(selectedEventIds.filter(id => id !== event.id))
                        }
                      }}
                    />
                    {event.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={calculateRankSum}
              disabled={calculating}
              className="bg-blue-600 text-white px-4 py-2 rounded-md mb-4"
            >
              {calculating ? '计算中...' : '计算排名总和'}
            </button>
            {rankSumResult.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full border">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="px-4 py-2 border">总分排名</th>
                      <th className="px-4 py-2 border">选手姓名</th>
                      <th className="px-4 py-2 border">网站ID</th>
                      <th className="px-4 py-2 border">总分</th>
                      <th className="px-4 py-2 border">各项目排名详情</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankSumResult.map((item, idx) => (
                      <tr key={item.userId} className="border-b">
                        <td className="px-4 py-2 text-center">{idx + 1}</td>
                        <td className="px-4 py-2">{item.username}</td>
                        <td className="px-4 py-2">{item.siteId}</td>
                        <td className="px-4 py-2 text-center">{item.total}</td>
                        <td className="px-4 py-2">
                          {Object.entries(item.details).map(([eventId, rank]) => {
                            const eventName = allEvents.find(e => e.id === parseInt(eventId))?.name || eventId
                            return <div key={eventId}>{eventName}: {rank}名</div>
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={scrollToTop}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '9999px',
          padding: '0.75rem',
          boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
          cursor: 'pointer',
          fontSize: '1.25rem',
          lineHeight: '1',
        }}
        aria-label="回到顶部"
      >
        ↑
      </button>
    </div>
  )
}