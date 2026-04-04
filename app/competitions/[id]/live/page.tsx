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

    // 订阅 results 表（成绩变化）
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

    // 订阅 events 表（轮次状态变化）
    const eventsChannel = supabase
      .channel('events-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'events' },
        async (payload) => {
          const updatedEvent = payload.new
          const newRoundsStatus = updatedEvent.rounds_status || {}
          // 更新 options 中对应选项的状态
          setOptions(prev => prev.map(opt => {
            if (opt.eventId === updatedEvent.id) {
              const newStatus = newRoundsStatus[opt.round] || 'not_started'
              return { ...opt, status: newStatus, statusLabel: STATUS_MAP[newStatus] }
            }
            return opt
          }))
          // 如果当前选中的选项是该项目中的某个轮次，且状态发生变化，则更新 selectedOption 的状态标签
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

  // 用户手动切换选项
  const handleOptionChange = async (optionKey: string) => {
    const opt = options.find(o => `${o.eventId}_${o.round}` === optionKey)
    if (!opt) return
    setSelectedOption(opt)
    await loadRankings(opt)
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

      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>{title} - {competition.name}</h1>

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