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
  groupKey?: string
}

export default function LivePage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [options, setOptions] = useState<Option[]>([])
  const [selectedOption, setSelectedOption] = useState<Option | null>(null)
  const [rankings, setRankings] = useState<RankGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('成绩直播')
  const [regToGroupKey, setRegToGroupKey] = useState<Map<number, string>>(new Map())
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  useEffect(() => {
    if (competition) {
      document.title = `成绩直播 - ${competition.name} - 赛事平台`
    }
  }, [competition])

  const loadRankings = async (option: Option): Promise<Map<number, string>> => {
    const { data: registrations } = await supabase
      .from('registrations')
      .select('id, user_id, event_id, status, created_at')
      .eq('competition_id', competitionId)
      .eq('event_id', option.eventId)
      .eq('status', 'registered')
      .order('created_at', { ascending: true })

    if (!registrations || registrations.length === 0) {
      setRankings([])
      setRegToGroupKey(new Map())
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
    const newRegToGroupKey = new Map<number, string>()
    for (let idx = 0; idx < groups.length; idx++) {
      const { group, regIds } = groups[idx]
      const userKeys = group.users.map(u => u.user_id).sort().join(',')
      const groupKey = `${option.eventId}_${option.round}_${userKeys}`
      const rankedGroup = {
        ...group,
        rank: group.average !== null ? rank++ : null,
        groupKey,
      }
      finalRanked.push(rankedGroup)
      for (const regId of regIds) {
        newRegToGroupKey.set(regId, groupKey)
      }
    }

    setRankings(finalRanked)
    setRegToGroupKey(newRegToGroupKey)
    return newRegToGroupKey
  }

  const triggerHighlight = (registrationId: number, newMapping: Map<number, string>) => {
    const groupKey = newMapping.get(registrationId)
    if (!groupKey) return
    const row = document.querySelector(`tr[data-group-key="${groupKey}"]`) as HTMLElement
    if (!row) return
    if (timeoutRefs.current.has(groupKey)) {
      clearTimeout(timeoutRefs.current.get(groupKey)!)
    }
    row.classList.add('highlight-flash')
    const timeout = setTimeout(() => {
      row.classList.remove('highlight-flash')
      timeoutRefs.current.delete(groupKey)
    }, 3000)
    timeoutRefs.current.set(groupKey, timeout)
  }

  useEffect(() => {
    const unwrapParams = async () => {
      const { id } = await params
      setCompetitionId(id)
    }
    unwrapParams()
  }, [params])

  const [allEvents, setAllEvents] = useState<any[]>([])
  const [showRankSumModal, setShowRankSumModal] = useState(false)
  const [selectedEventIds, setSelectedEventIds] = useState<number[]>([])
  const [rankSumResult, setRankSumResult] = useState<any[]>([])
  const [calculating, setCalculating] = useState(false)

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

  useEffect(() => {
    if (!competitionId || !selectedOption) return

    const resultsChannel = supabase
      .channel('results-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'results' },
        async (payload) => {
          const newMapping = await loadRankings(selectedOption)
          let registrationId: number | null = null
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            registrationId = payload.new.registration_id
          } else if (payload.eventType === 'DELETE') {
            registrationId = payload.old.registration_id
          }
          if (registrationId) {
            setTimeout(() => {
              triggerHighlight(registrationId, newMapping)
            }, 150)
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
  }, [competitionId, selectedOption])

  const handleOptionChange = async (optionKey: string) => {
    const opt = options.find(o => `${o.eventId}_${o.round}` === optionKey)
    if (!opt) return
    setSelectedOption(opt)
    await loadRankings(opt)
  }

  const calculateRankSum = async () => {
    if (selectedEventIds.length === 0) {
      alert('请至少选择一个项目')
      return
    }
    setCalculating(true)
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
    const allUserIds = [...new Set(registrations.map(r => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, site_id')
      .in('id', allUserIds)
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const playerScore: Record<string, { total: number; details: Record<number, number | null> }> = {}
    for (const userId of allUserIds) {
      playerScore[userId] = { total: 0, details: {} }
    }

    for (const eventId of selectedEventIds) {
      const event = allEvents.find(e => e.id === eventId)
      if (!event) continue
      const finalRound = Math.max(...(event.rounds || [1, 2, 3, 4]))
      const { data: eventRegistrations } = await supabase
        .from('registrations')
        .select('id, user_id')
        .eq('competition_id', competitionId)
        .eq('event_id', eventId)
        .eq('status', 'registered')
      if (!eventRegistrations || eventRegistrations.length === 0) {
        const rankForMissing = 1
        for (const userId of allUserIds) {
          playerScore[userId].total += rankForMissing
          playerScore[userId].details[eventId] = rankForMissing
        }
        continue
      }

      const regIds = eventRegistrations.map(r => r.id)
      const { data: results } = await supabase
        .from('results')
        .select('registration_id, average, group_id')
        .in('registration_id', regIds)
        .eq('round', finalRound)

      const regToAvg = new Map<number, number>()
      results?.forEach(r => regToAvg.set(r.registration_id, r.average))

      const groupToRegs = new Map<string, typeof eventRegistrations>()
      for (const reg of eventRegistrations) {
        const result = results?.find(r => r.registration_id === reg.id)
        const groupId = result?.group_id || `single-${reg.id}`
        if (!groupToRegs.has(groupId)) groupToRegs.set(groupId, [])
        groupToRegs.get(groupId)!.push(reg)
      }

      const groupScores: { groupId: string; avg: number; regs: typeof eventRegistrations }[] = []
      for (const [groupId, regs] of groupToRegs.entries()) {
        let avg: number | null = null
        for (const reg of regs) {
          const a = regToAvg.get(reg.id)
          if (a !== undefined) {
            avg = a
            break
          }
        }
        if (avg !== null) {
          groupScores.push({ groupId, avg, regs })
        }
      }

      groupScores.sort((a, b) => a.avg - b.avg)
      let rank = 1
      for (let i = 0; i < groupScores.length; i++) {
        const current = groupScores[i]
        let currentRank = i + 1
        if (i > 0 && current.avg === groupScores[i-1].avg) {
          currentRank = rank
        } else {
          rank = currentRank
        }
        for (const reg of current.regs) {
          const userId = reg.user_id
          playerScore[userId].total += currentRank
          playerScore[userId].details[eventId] = currentRank
        }
      }

      const allGroups = Array.from(groupToRegs.keys())
      const scoredGroupIds = new Set(groupScores.map(g => g.groupId))
      const missingGroupIds = allGroups.filter(g => !scoredGroupIds.has(g))
      const rankForMissing = groupScores.length + 1
      for (const groupId of missingGroupIds) {
        const regs = groupToRegs.get(groupId)!
        for (const reg of regs) {
          const userId = reg.user_id
          playerScore[userId].total += rankForMissing
          playerScore[userId].details[eventId] = rankForMissing
        }
      }

      const registeredUserIds = new Set(eventRegistrations.map(r => r.user_id))
      const missingUserIds = allUserIds.filter(uid => !registeredUserIds.has(uid))
      const rankForMissingUser = groupScores.length + 1
      for (const userId of missingUserIds) {
        playerScore[userId].total += rankForMissingUser
        playerScore[userId].details[eventId] = rankForMissingUser
      }
    }

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
          style={{
            backgroundColor: '#10b981',
            color: 'white',
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s, transform 0.1s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#059669')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#10b981')}
          onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
          onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
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
                        data-group-key={group.groupKey}
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

      {showRankSumModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ backdropFilter: 'blur(2px)' }}>
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-4xl w-full max-h-[85vh] overflow-auto transform transition-all">
            <div className="flex justify-between items-center mb-5 border-b pb-3">
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                排名总和计算
              </h2>
              <button
                onClick={() => setShowRankSumModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
              >
                ×
              </button>
            </div>
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">选择项目（多选）</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 p-4 rounded-lg">
                {allEvents.map(event => (
                  <label key={event.id} className="flex items-center gap-2 text-sm hover:bg-gray-100 p-1 rounded transition">
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
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <span>{event.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-center mb-6">
              <button
                onClick={calculateRankSum}
                disabled={calculating}
                className="px-6 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ transform: 'translateY(0)' }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'translateY(1px)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {calculating ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    计算中...
                  </span>
                ) : (
                  '计算排名总和'
                )}
              </button>
            </div>
            {rankSumResult.length > 0 && (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分排名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">选手姓名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">网站ID</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总分</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">各项目排名详情</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rankSumResult.map((item, idx) => (
                      <tr key={item.userId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{idx + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">{item.username}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{item.siteId}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-gray-900">{item.total}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {Object.entries(item.details).map(([eventId, rank]) => {
                            const eventName = allEvents.find(e => e.id === parseInt(eventId))?.name || eventId
                            return <div key={eventId} className="inline-block bg-gray-100 rounded-full px-2 py-0.5 text-xs mr-1 mb-1">{eventName}: {rank}名</div>
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
          transition: 'background-color 0.2s, transform 0.1s',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#2563eb')}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#3b82f6')}
        onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.95)')}
        onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        aria-label="回到顶部"
      >
        ↑
      </button>
    </div>
  )
}