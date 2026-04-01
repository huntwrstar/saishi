'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const ROUNDS = [
  { value: 1, label: '初赛' },
  { value: 2, label: '复赛' },
  { value: 3, label: '半决赛' },
  { value: 4, label: '决赛' },
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

export default function FinalResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const [competitionId, setCompetitionId] = useState<string | null>(null)
  const [competition, setCompetition] = useState<any>(null)
  const [events, setEvents] = useState<any[]>([])
  const [mode, setMode] = useState<'top3' | 'all'>('top3')
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)
  const [rankingsData, setRankingsData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
      const { data: comp } = await supabase
        .from('competitions')
        .select('*')
        .eq('id', competitionId)
        .single()
      setCompetition(comp)

      const { data: evts } = await supabase
        .from('events')
        .select('*')
        .eq('competition_id', competitionId)
      setEvents(evts || [])

      if (!evts || evts.length === 0) {
        setLoading(false)
        return
      }

      if (mode === 'top3') {
        await fetchTop3(evts)
      } else {
        if (selectedEvent !== null) {
          await fetchAllRoundsForEvent(selectedEvent)
        } else if (evts.length > 0) {
          setSelectedEvent(evts[0].id)
          await fetchAllRoundsForEvent(evts[0].id)
        }
      }
      setLoading(false)
    }

    const fetchTop3 = async (evts: any[]) => {
      const top3Results: any = {}
      for (const event of evts) {
        const rounds = event.rounds || [1, 2, 3, 4]
        const finalRound = Math.max(...rounds)

        const { data: registrations } = await supabase
          .from('registrations')
          .select('id, user_id, event_id, status, created_at')
          .eq('competition_id', competitionId)
          .eq('event_id', event.id)
          .eq('status', 'registered')
          .order('created_at', { ascending: true })

        if (!registrations || registrations.length === 0) {
          top3Results[event.id] = []
          continue
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
          .eq('round', finalRound)

        const resultsByReg = new Map()
        results?.forEach(r => resultsByReg.set(r.registration_id, r))

        const groupMap = new Map<string, any>()
        for (const reg of registrations) {
          const result = resultsByReg.get(reg.id)
          if (!result) continue
          const groupId = result.group_id || `single-${reg.id}`
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              users: [],
              average: result.average,
              best: result.best,
              attemptData: result.attempt_data,
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
        groups.sort((a, b) => a.average - b.average)
        const top3 = groups.slice(0, 3).map((item, idx) => ({
          rank: idx + 1,
          users: item.users,
          average: item.average,
          best: item.best,
          attemptData: item.attemptData,
        }))
        top3Results[event.id] = top3
      }
      setRankingsData(top3Results)
    }

    const fetchAllRoundsForEvent = async (eventId: number) => {
      const event = events.find(e => e.id === eventId)
      if (!event) return

      const rounds = event.rounds || [1, 2, 3, 4]
      const roundResults: any = {}

      const { data: registrations } = await supabase
        .from('registrations')
        .select('id, user_id, event_id, status, created_at')
        .eq('competition_id', competitionId)
        .eq('event_id', eventId)
        .eq('status', 'registered')
        .order('created_at', { ascending: true })

      if (!registrations || registrations.length === 0) {
        setRankingsData({})
        return
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

      for (const round of rounds) {
        const { data: results } = await supabase
          .from('results')
          .select('*')
          .in('registration_id', regIds)
          .eq('round', round)

        const resultsByReg = new Map()
        results?.forEach(r => resultsByReg.set(r.registration_id, r))

        const groupMap = new Map<string, any>()
        for (const reg of registrations) {
          const result = resultsByReg.get(reg.id)
          if (!result) continue
          const groupId = result.group_id || `single-${reg.id}`
          if (!groupMap.has(groupId)) {
            groupMap.set(groupId, {
              users: [],
              average: result.average,
              best: result.best,
              attemptData: result.attempt_data,
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
        groups.sort((a, b) => a.average - b.average)
        const ranked = groups.map((item, idx) => ({
          rank: idx + 1,
          users: item.users,
          average: item.average,
          best: item.best,
          attemptData: item.attemptData,
        }))
        roundResults[round] = ranked
      }
      setRankingsData(roundResults)
    }

    fetchData()
  }, [competitionId, mode, selectedEvent])

  useEffect(() => {
    if (mode === 'all' && events.length > 0 && selectedEvent === null) {
      setSelectedEvent(events[0].id)
    }
  }, [mode, events])

  const handleModeChange = (newMode: 'top3' | 'all') => {
    setMode(newMode)
    if (newMode === 'top3') {
      // 重新加载 top3 数据（已在 useEffect 中依赖 mode）
    } else {
      if (selectedEvent === null && events.length > 0) {
        setSelectedEvent(events[0].id)
      }
    }
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

      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>赛果 - {competition.name}</h1>
      <p style={{ color: '#4b5563', marginBottom: '1.5rem' }}>比赛日期：{new Date(competition.datetime).toLocaleDateString()}</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => handleModeChange('top3')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: mode === 'top3' ? '#3b82f6' : '#e5e7eb',
            color: mode === 'top3' ? 'white' : '#1f2937',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          前三
        </button>
        <button
          onClick={() => handleModeChange('all')}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: mode === 'all' ? '#3b82f6' : '#e5e7eb',
            color: mode === 'all' ? 'white' : '#1f2937',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          所有成绩
        </button>
      </div>

      {mode === 'all' && events.length > 0 && (
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>选择项目：</label>
          <select
            value={selectedEvent || ''}
            onChange={(e) => setSelectedEvent(Number(e.target.value))}
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
            }}
          >
            {events.map(event => (
              <option key={event.id} value={event.id}>{event.name}</option>
            ))}
          </select>
        </div>
      )}

      {mode === 'top3' && (
        <>
          {events.map(event => {
            const top3 = rankingsData?.[event.id] || []
            const roundLabel = ROUNDS.find(r => r.value === Math.max(...(event.rounds || [1,2,3,4])))?.label || '决赛'
            return (
              <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', marginBottom: '1.5rem', overflow: 'hidden' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{event.name} - {roundLabel}</h2>
                </div>
                {top3.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>暂无决赛成绩</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>名次</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>选手</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>平均成绩</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>最好成绩</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>成绩详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {top3.map(item => {
                          const usernames = item.users.map((u: any) => u.username).join(', ')
                          return (
                            <tr key={item.rank} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{item.rank}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{usernames}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(item.average)}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(item.best)}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{item.attemptData.join(', ')}</td>
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
        </>
      )}

      {mode === 'all' && selectedEvent && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
            <h2 style={{ fontSize: '1.125rem', fontWeight: '600' }}>{events.find(e => e.id === selectedEvent)?.name} - 所有轮次</h2>
          </div>
          {rankingsData && Object.keys(rankingsData).length === 0 ? (
            <div style={{ padding: '1rem', textAlign: 'center', color: '#6b7280' }}>暂无成绩</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              {Object.entries(rankingsData).map(([round, groups]: [string, any[]]) => {
                const roundNum = parseInt(round)
                const roundLabel = ROUNDS.find(r => r.value === roundNum)?.label || `第${roundNum}轮`
                return (
                  <div key={round} style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ padding: '0.75rem 1rem', backgroundColor: '#f3f4f6', fontSize: '1rem', fontWeight: '600' }}>{roundLabel}</h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#f9fafb' }}>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>排名</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>选手</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>平均成绩</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>最好成绩</th>
                          <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>成绩详情</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map((item: any, idx: number) => {
                          const usernames = item.users.map((u: any) => u.username).join(', ')
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid #e5e7eb' }}>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{item.rank}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{usernames}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(item.average)}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{formatTime(item.best)}</td>
                              <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{item.attemptData.join(', ')}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })}
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