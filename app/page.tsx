import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

export default async function Home() {
  const { data: competitions } = await supabase
    .from('competitions')
    .select('*')
    .order('datetime', { ascending: false })

  return (
    <div className="container py-8">
      <h1 className="text-xl font-bold mb-6">赛事列表</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {competitions?.map(comp => (
          <div key={comp.id} className="card">
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-2">{comp.name}</h2>
              <div className="text-sm text-gray-500 mb-4">
                <p>日期：{new Date(comp.datetime).toLocaleDateString()}</p>
                <p>地点：{comp.location}</p>
                {comp.registration_start && (
                  <p>报名：{new Date(comp.registration_start).toLocaleDateString()} - {comp.registration_end ? new Date(comp.registration_end).toLocaleDateString() : '无结束'}</p>
                )}
                {comp.withdrawal_deadline && <p>退赛截止：{new Date(comp.withdrawal_deadline).toLocaleDateString()}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Link href={`/competitions/${comp.id}`} className="btn btn-primary">
                  查看详情
                </Link>
                {!comp.is_finished && new Date() > new Date(comp.datetime) && (
                  <Link href={`/competitions/${comp.id}/live`} className="btn btn-secondary">
                    成绩直播
                  </Link>
                )}
                {comp.is_finished && (
                  <Link href={`/competitions/${comp.id}/final-results`} className="btn btn-secondary">
                    赛果
                  </Link>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}