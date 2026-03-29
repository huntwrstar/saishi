'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import * as React from 'react'

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

  const fetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

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

  if (loading) return <div className="text-center py-8">加载中...</div>
  if (!competition) return <div className="text-center text-red-500 py-8">赛事不存在</div>

  const isPastWithdrawal = competition.withdrawal_deadline ? new Date() > new Date(competition.withdrawal_deadline) : false
  const isRegistrationOpen = (() => {
    const now = new Date()
    if (competition.registration_start && now < new Date(competition.registration_start)) return false
    if (competition.registration_end && now > new Date(competition.registration_end)) return false
    return true
  })()

  return (
    <div className="container py-8">
      <div className="card p-6 mb-8">
        <h1 className="text-xl font-bold mb-4">{competition.name}</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700 mb-4">
<p>日期：{new Date(competition.datetime).toLocaleDateString()}</p>
<p>地点：{competition.location}</p>
<p>基础报名费：¥{competition.base_fee}</p>
{competition.registration_start && (
  <p>报名时间：{new Date(competition.registration_start).toLocaleString()} - {competition.registration_end ? new Date(competition.registration_end).toLocaleString() : '无结束'}</p>
)}
<p>退赛截止：{competition.withdrawal_deadline ? new Date(competition.withdrawal_deadline).toLocaleString() : '无'}</p>
        </div>
        <details className="mb-4">
          <summary className="text-primary cursor-pointer">关于比赛</summary>
<div
  className="mt-2 text-gray-600"
  dangerouslySetInnerHTML={{ __html: competition.description || '' }}
/>
        </details>
        <div className="flex gap-2">
          <Link href={`/competitions/${competitionId}/live`} className="btn btn-primary">成绩直播</Link>
          <Link href={`/competitions/${competitionId}/participants`} className="btn btn-outline">参赛选手</Link>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-4">项目列表</h2>
      <div className="space-y-4">
        {events.map(event => {
          const reg = registrations.find(r => r.event_id === event.id)
          const isRegistered = reg && reg.status === 'registered'
          const isWithdrawn = reg && reg.status === 'withdrawn'
          const isSelected = selectedEvents.includes(event.id)

          return (
            <div key={event.id} className="card p-4 flex flex-wrap justify-between items-center">
              <label className="flex items-center gap-2 cursor-pointer">
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
                  className="w-4 h-4"
                />
                <span className="font-medium">{event.name}</span>
                {event.extra_fee > 0 && <span className="text-sm text-gray-500">(+¥{event.extra_fee})</span>}
              </label>
              {isRegistered && (
                <button
                  onClick={() => reg && handleWithdraw(reg.id, event.id)}
                  disabled={isPastWithdrawal || actionLoading === event.id}
                  className="btn btn-danger text-sm"
                >
                  {actionLoading === event.id ? '处理中...' : '退赛'}
                </button>
              )}
              {isWithdrawn && <span className="text-sm text-gray-500">已退赛</span>}
            </div>
          )
        })}
      </div>

      {user && isRegistrationOpen && (
        <div className="card p-4 mt-6">
          <p className="font-semibold">总费用：¥{totalFee.toFixed(2)}</p>
          <div className="flex gap-2 mt-4">
            <button onClick={handleBatchRegister} disabled={loading || selectedEvents.length === 0} className="btn btn-primary">
              {loading ? '提交中...' : '报名选中项目'}
            </button>
            {registrations.some(r => r.status === 'registered') && !isPastWithdrawal && (
              <button onClick={handleWithdrawAll} disabled={loading} className="btn btn-danger">
                退赛全部项目
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}