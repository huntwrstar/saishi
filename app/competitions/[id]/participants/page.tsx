import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = await params

  // 获取所有报名记录（状态为 registered），按报名时间升序
  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('id, user_id, event_id, created_at')
    .eq('competition_id', competitionId)
    .eq('status', 'registered')
    .order('created_at', { ascending: true })

  if (regError || !registrations || registrations.length === 0) {
    return (
      <div className="container py-8 text-center">
        <div style={{ marginBottom: '1rem' }}>
          <Link href={`/competitions/${competitionId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
            ← 返回赛事详情
          </Link>
        </div>
        <div>暂无参赛选手</div>
      </div>
    )
  }

  // 每个选手只取最早的一条报名记录，用于生成报名序号
  const userFirstRegMap = new Map()
  for (const reg of registrations) {
    if (!userFirstRegMap.has(reg.user_id)) {
      userFirstRegMap.set(reg.user_id, reg)
    }
  }
  const firstRegs = Array.from(userFirstRegMap.values())
  firstRegs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  const orderMap = new Map()
  firstRegs.forEach((reg, idx) => orderMap.set(reg.user_id, idx + 1))

  // 获取选手信息
  const userIds = [...new Set(registrations.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, site_id')
    .in('id', userIds)
  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

  // 获取项目信息
  const eventIds = [...new Set(registrations.map(r => r.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('id, name')
    .in('id', eventIds)
  const eventMap = new Map(events?.map(e => [e.id, e]) || [])

  // 按选手分组
  const participantsMap = new Map()
  registrations.forEach(reg => {
    const profile = profileMap.get(reg.user_id)
    if (!profile) return
    const event = eventMap.get(reg.event_id)
    if (!event) return
    const order = orderMap.get(reg.user_id)
    if (!participantsMap.has(profile.id)) {
      participantsMap.set(profile.id, { username: profile.username, events: [], order })
    }
    participantsMap.get(profile.id).events.push(event.name)
  })

  const participants = Array.from(participantsMap.values()).sort((a, b) => a.order - b.order)

  return (
    <div className="container py-8">
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/competitions/${competitionId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← 返回赛事详情
        </Link>
      </div>
      <h1 className="text-xl font-bold mb-6">参赛选手</h1>
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>报名序号</th>
                <th>选手姓名</th>
                <th>报名项目</th>
               </thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.order}>
                  <td className="px-4 py-3 text-sm text-gray-900">{p.order}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{p.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-900">{p.events.join(', ')}</td>
                </tr>
              ))}
            </tbody>
           </table>
        </div>
      </div>
    </div>
  )
}