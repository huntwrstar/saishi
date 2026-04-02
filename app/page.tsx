export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'
import { formatDate, formatDateTime } from '@/lib/format'

export default async function Home() {
  const { data: competitions } = await supabase
    .from('competitions')
    .select('*')
    .order('datetime', { ascending: false })

  return (
    <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>赛事列表</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {competitions?.map(comp => (
          <div key={comp.id} style={{ backgroundColor: 'white', borderRadius: '0.75rem', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{comp.name}</h2>
              <div style={{ fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' }}>
                <p>日期：{formatDate(comp.datetime)}</p>
                <p>地点：{comp.location}</p>
                {comp.registration_start && (
  <p>报名：{formatDateTime(comp.registration_start)} - {comp.registration_end ? formatDateTime(comp.registration_end) : '无结束'}</p>
)}
{comp.withdrawal_deadline && <p>退赛截止：{formatDateTime(comp.withdrawal_deadline)}</p>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <Link href={`/competitions/${comp.id}`} style={{ backgroundColor: '#3b82f6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem' }}>
                  查看详情
                </Link>
                {!comp.is_finished && new Date() > new Date(comp.datetime) && (
                  <Link href={`/competitions/${comp.id}/live`} style={{ backgroundColor: '#10b981', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem' }}>
                    成绩直播
                  </Link>
                )}
                {comp.is_finished && (
                  <Link href={`/competitions/${comp.id}/final-results`} style={{ backgroundColor: '#8b5cf6', color: 'white', padding: '0.5rem 1rem', borderRadius: '0.375rem', textDecoration: 'none', fontSize: '0.875rem' }}>
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