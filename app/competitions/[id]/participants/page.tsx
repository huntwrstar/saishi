import { supabase } from '@/lib/supabase/client'

export default async function ParticipantsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = await params

  const { data: registrations, error: regError } = await supabase
    .from('registrations')
    .select('id, user_id, event_id, created_at')
    .eq('competition_id', competitionId)
    .eq('status', 'registered')
    .order('created_at', { ascending: true })

  if (regError || !registrations || registrations.length === 0) {
    return <div className="container py-8 text-center">暂无参赛选手</div>
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
  const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds)
  const eventIds = [...new Set(registrations.map(r => r.event_id))]
  const { data: events } = await supabase.from('events').select('id, name').in('id', eventIds)

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
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">参赛选手</h1>
      <div className="card overflow-hidden">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>NO.</th>
                <th>选手</th>
                <th>项目</th>
              </tr>
            </thead>
            <tbody>
              {participants.map(p => (
                <tr key={p.order}>
                  <td>{p.order}</td>
                  <td>{p.username}</td>
                  <td>{p.events.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}