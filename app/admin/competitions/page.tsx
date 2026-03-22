'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function AdminCompetitions() {
  const [competitions, setCompetitions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchCompetitions = async () => {
    const { data } = await supabase.from('competitions').select('*').order('datetime', { ascending: false })
    setCompetitions(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchCompetitions() }, [])

  const handleEndCompetition = async (id: number) => {
    if (!confirm('结束比赛后成绩直播将变为“赛果”。确认吗？')) return
    await supabase.from('competitions').update({ is_finished: true }).eq('id', id)
    fetchCompetitions()
  }

  const handleDeleteCompetition = async (id: number, name: string) => {
    if (!confirm(`删除赛事“${name}”将同时删除所有关联数据，不可恢复。确认吗？`)) return
    await supabase.from('competitions').delete().eq('id', id)
    fetchCompetitions()
  }

  if (loading) return <div className="container py-8 text-center">加载中...</div>

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">管理赛事</h1>
        <Link href="/admin/competitions/new" className="btn btn-primary">新建赛事</Link>
      </div>
      {competitions.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">暂无赛事</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>赛事名称</th>
                  <th>日期</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {competitions.map(comp => (
                  <tr key={comp.id}>
                    <td>{comp.name}</td>
                    <td>{new Date(comp.datetime).toLocaleDateString()}</td>
                    <td>{comp.is_finished ? '已结束' : '进行中'}</td>
                    <td className="flex gap-2">
                      <Link href={`/admin/competitions/${comp.id}/edit`} className="text-primary">编辑</Link>
                      <Link href={`/admin/competitions/${comp.id}/events`} className="text-primary">项目</Link>
                      <Link href={`/admin/competitions/${comp.id}/results`} className="text-primary">成绩</Link>
                      {!comp.is_finished && (
                        <button onClick={() => handleEndCompetition(comp.id)} className="text-green-600">结束</button>
                      )}
                      <button onClick={() => handleDeleteCompetition(comp.id, comp.name)} className="text-red-600">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}