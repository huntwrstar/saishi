import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = await params

  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('id, user_id, event_id, created_at')
    .eq('competition_id', competitionId)
    .eq('status', 'registered')
    .order('created_at', { ascending: true })

  if (regError || !registrations || registrations.length === 0) {
    return (
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <Link href={`/competitions/${competitionId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
            ← 返回赛事详情
          </Link>
        </div>
        <div className="text-center py-8">暂无参赛选手</div>
      </div>
    )
  }

  // 计算报名序号
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

  const userIds = [...new Set(registrations.map(r => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username')
    .in('id', userIds)
  const eventIds = [...new Set(registrations.map(r => r.event_id))]
  const { data: events } = await supabase
    .from('events')
    .select('id, name')
    .in('id', eventIds)

  const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])
  const eventMap = new Map(events?.map(e => [e.id, e]) || [])

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
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/competitions/${competitionId}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>
          ← 返回赛事详情
        </Link>
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>参赛选手</h1>
      <div style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>报名序号</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>选手姓名</th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.75rem', fontWeight: '600', color: '#6b7280' }}>报名项目</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.order} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{p.order}记
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{p.username}记
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem' }}>{p.events.join(', ')}记
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}