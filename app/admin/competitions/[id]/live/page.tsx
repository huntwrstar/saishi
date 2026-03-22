import { supabase } from '@/lib/supabase/client'

export default async function LivePage({ params }: { params: { id: string } }) {
  // 获取赛事信息
  const { data: competition } = await supabase
    .from('competitions')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!competition) return <div>赛事不存在</div>

  // 获取项目列表
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('competition_id', params.id)

  // 获取每个项目的成绩排名
  const getRankings = async (eventId: number) => {
    const { data } = await supabase
      .from('results')
      .select(`
        average,
        best,
        attempt_data,
        registrations!inner (
          id,
          user_id,
          profiles!inner ( username, site_id )
        )
      `)
      .eq('registrations.competition_id', params.id)
      .eq('registrations.event_id', eventId)
      .eq('registrations.status', 'registered')
      .order('average', { ascending: true })
      .order('best', { ascending: true })

    if (!data) return []

    // 添加排名序号
    const ranked = data.map((item, idx) => ({
      rank: idx + 1,
      siteId: item.registrations.profiles.site_id,
      username: item.registrations.profiles.username,
      average: item.average,
      best: item.best,
      details: item.attempt_data.join(', '),
    }))

    return ranked
  }

  const title = competition.is_finished ? '赛果' : '成绩直播'

  return (
    <div style={{ padding: '2rem' }}>
      <h1>{title} - {competition.name}</h1>
      {events?.map(async event => {
        const rankings = await getRankings(event.id)
        return (
          <div key={event.id} style={{ marginBottom: '2rem' }}>
            <h2>{event.name}</h2>
            {rankings.length === 0 ? (
              <p>暂无成绩</p>
            ) : (
              <table border={1} cellPadding="8" style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    <th>排名</th>
                    <th>报名序号</th>
                    <th>选手姓名</th>
                    <th>平均成绩</th>
                    <th>最好成绩</th>
                    <th>成绩详情</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map(r => (
                    <tr key={r.siteId}>
                      <td>{r.rank}</td>
                      <td>{r.siteId}</td>
                      <td>{r.username}</td>
                      <td>{r.average.toFixed(2)}</td>
                      <td>{r.best.toFixed(2)}</td>
                      <td>{r.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )
}