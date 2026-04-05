'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as React from 'react'
import { formatDate, formatDateTime } from '@/lib/format'

// 固定项目顺序（与成绩直播页、赛果页保持一致）
const FIXED_EVENTS_ORDER = [
  '三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲',
  '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲'
]

interface Competition {
  id: number
  name: string
  datetime: string
  location: string
  description: string
  withdrawal_deadline: string | null
  registration_start: string | null
  registration_end: string | null
  base_fee: number
  is_finished: boolean
}

interface Event {
  id: number
  name: string
  calculation_rule: string
  extra_fee: number
}

interface Registration {
  id: number
  event_id: number
  status: 'registered' | 'withdrawn'
}

export default function CompetitionDetail({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: competitionId } = React.use(params)
  const [competition, setCompetition] = useState<Competition | null>(null)
  const [events, setEvents] = useState<Event[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [selectedEvents, setSelectedEvents] = useState<number[]>([])
  // 关于比赛的展开状态
  const [detailsOpen, setDetailsOpen] = useState(true)
  const autoCloseTimer = useRef<NodeJS.Timeout | null>(null)

  // 设置页面标题
  useEffect(() => {
    if (competition) {
      document.title = `${competition.name} - 赛事平台`
    }
  }, [competition])

  // 自动收起逻辑
  useEffect(() => {
    if (detailsOpen && competition) {
      // 如果有定时器先清除
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
      autoCloseTimer.current = setTimeout(() => {
        setDetailsOpen(false)
        autoCloseTimer.current = null
      }, 10000) // 10秒
    }
    return () => {
      if (autoCloseTimer.current) clearTimeout(autoCloseTimer.current)
    }
  }, [detailsOpen, competition])

  const handleDetailsToggle = (open: boolean) => {
    setDetailsOpen(open)
    // 如果用户手动展开，清除自动收起的定时器
    if (open && autoCloseTimer.current) {
      clearTimeout(autoCloseTimer.current)
      autoCloseTimer.current = null
    }
  }

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    const { data: comp } = await supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .maybeSingle()
    setCompetition(comp || null)

    const { data: evts } = await supabase
      .from('events')
      .select('*')
      .eq('competition_id', competitionId)

    const sortedEvents = (evts || []).sort((a, b) => {
      const aIndex = FIXED_EVENTS_ORDER.indexOf(a.name)
      const bIndex = FIXED_EVENTS_ORDER.indexOf(b.name)
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      if (aIndex !== -1) return -1
      if (bIndex !== -1) return 1
      return a.id - b.id
    })
    setEvents(sortedEvents)

    if (user) {
      const { data: regs } = await supabase
        .from('registrations')
        .select('id, event_id, status')
        .eq('user_id', user.id)
        .eq('competition_id', competitionId)
      setRegistrations(regs || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [competitionId])

  const totalFee = (competition?.base_fee || 0) + events.reduce((sum, event) => {
    if (selectedEvents.includes(event.id)) {
      return sum + (event.extra_fee || 0)
    }
    return sum
  }, 0)

  const handleBatchRegister = async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }
    const now = new Date()
    if (competition?.registration_start && now < new Date(competition.registration_start)) {
      alert('报名尚未开始')
      return
    }
    if (competition?.registration_end && now > new Date(competition.registration_end)) {
      alert('报名已结束')
      return
    }

    const toRegister = selectedEvents.filter(eventId => {
      const reg = registrations.find(r => r.event_id === eventId)
      return !reg || reg.status === 'withdrawn'
    })

    if (toRegister.length === 0) {
      alert('请选择项目')
      return
    }

    setLoading(true)
    const inserts = toRegister.map(eventId => ({
      user_id: user.id,
      competition_id: competitionId,
      event_id: eventId,
      status: 'registered',
    }))
    const { error } = await supabase.from('registrations').insert(inserts)
    setLoading(false)
    if (error) {
      alert('报名失败：' + error.message)
    } else {
      alert('报名成功')
      fetchData()
      setSelectedEvents([])
    }
  }

  const handleWithdraw = async (registrationId: number, eventId: number) => {
    if (!competition?.withdrawal_deadline) return
    if (new Date() > new Date(competition.withdrawal_deadline)) {
      alert('退赛截止日期已过')
      return
    }

    setActionLoading(eventId)
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
      .eq('id', registrationId)
    if (!error) {
      fetchData()
    } else {
      alert('退赛失败：' + error.message)
    }
    setActionLoading(null)
  }

  const handleWithdrawAll = async () => {
    if (!competition?.withdrawal_deadline) return
    if (new Date() > new Date(competition.withdrawal_deadline)) {
      alert('退赛截止日期已过')
      return
    }

    const activeRegs = registrations.filter(r => r.status === 'registered')
    if (activeRegs.length === 0) {
      alert('您没有已报名的项目')
      return
    }

    setLoading(true)
    for (const reg of activeRegs) {
      await supabase
        .from('registrations')
        .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
        .eq('id', reg.id)
    }
    setLoading(false)
    alert('已退赛所有项目')
    fetchData()
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '2rem' }}>加载中...</div>
  if (!competition) return <div style={{ textAlign: 'center', padding: '2rem', color: 'red' }}>赛事不存在</div>

  const isPastWithdrawal = competition.withdrawal_deadline ? new Date() > new Date(competition.withdrawal_deadline) : false
  const isRegistrationOpen = (() => {
    const now = new Date()
    if (competition.registration_start && now < new Date(competition.registration_start)) return false
    if (competition.registration_end && now > new Date(competition.registration_end)) return false
    return true
  })()

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/" style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← 返回赛事列表
        </Link>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', padding: '1.5rem', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>{competition.name}</h1>
        <div style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <p>日期：{formatDate(competition.datetime)}</p>
          <p>地点：{competition.location}</p>
          <p>基础报名费：¥{competition.base_fee}</p>
          {competition.registration_start && (
            <p>报名时间：{formatDateTime(competition.registration_start)} - {competition.registration_end ? formatDateTime(competition.registration_end) : '无结束'}</p>
          )}
          <p>退赛截止：{competition.withdrawal_deadline ? formatDateTime(competition.withdrawal_deadline) : '无'}</p>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <summary
            style={{ color: '#3b82f6', cursor: 'pointer', listStyle: 'none', display: 'inline-block' }}
            onClick={() => handleDetailsToggle(!detailsOpen)}
          >
            {detailsOpen ? '▼ 关于比赛' : '▶ 关于比赛'}
          </summary>
          {detailsOpen && (
            <div
              style={{ marginTop: '0.5rem' }}
              dangerouslySetInnerHTML={{ __html: competition.description || '' }}
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {!competition.is_finished && new Date() > new Date(competition.datetime) && (
            <Link href={`/competitions/${competition.id}/live`} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none' }}>
              成绩直播
            </Link>
          )}
          {competition.is_finished && (
            <Link href={`/competitions/${competition.id}/final-results`} style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none' }}>
              赛果
            </Link>
          )}
          <Link href={`/competitions/${competition.id}/participants`} style={{ backgroundColor: '#4b5563', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none' }}>
            参赛选手
          </Link>
        </div>
      </div>

      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>项目列表</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {events.map(event => {
          const reg = registrations.find(r => r.event_id === event.id)
          const isRegistered = reg && reg.status === 'registered'
          const isWithdrawn = reg && reg.status === 'withdrawn'
          const isSelected = selectedEvents.includes(event.id)

          return (
            <div key={event.id} style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)', padding: '1rem', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isRegistered || isSelected}
                  disabled={isRegistered || !isRegistrationOpen}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedEvents([...selectedEvents, event.id])
                    } else {
                      setSelectedEvents(selectedEvents.filter(id => id !== event.id))
                    }
                  }}
                  style={{ width: '1rem', height: '1rem' }}
                />
                <span style={{ fontWeight: '500' }}>{event.name}</span>
                {event.extra_fee > 0 && <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>(+¥{event.extra_fee})</span>}
              </label>
              {isRegistered && (
                <button
                  onClick={() => reg && handleWithdraw(reg.id, event.id)}
                  disabled={isPastWithdrawal || actionLoading === event.id}
                  style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.25rem 0.75rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}
                >
                  {actionLoading === event.id ? '处理中...' : '退赛'}
                </button>
              )}
              {isWithdrawn && <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>已退赛</span>}
            </div>
          )
        })}
      </div>

      {user && isRegistrationOpen && (
        <div style={{ backgroundColor: 'white', borderRadius: '0.5rem', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)', padding: '1rem', marginTop: '2rem' }}>
          <p style={{ fontWeight: '600' }}>总费用：¥{totalFee.toFixed(2)}</p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              onClick={handleBatchRegister}
              disabled={loading || selectedEvents.length === 0}
              style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
            >
              {loading ? '提交中...' : '报名选中项目'}
            </button>
            {registrations.some(r => r.status === 'registered') && !isPastWithdrawal && (
              <button
                onClick={handleWithdrawAll}
                disabled={loading}
                style={{ backgroundColor: '#ef4444', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', border: 'none', cursor: 'pointer' }}
              >
                退赛全部项目
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}