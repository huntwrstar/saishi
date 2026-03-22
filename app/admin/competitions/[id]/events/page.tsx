'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

export default function ManageEvents({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: competitionId } = React.use(params)
  const [events, setEvents] = useState<any[]>([])
  const [newEventName, setNewEventName] = useState('')
  const [newEventRule, setNewEventRule] = useState('avg_of_3')
  const [newEventExtraFee, setNewEventExtraFee] = useState(0)
  const [newEventIsTeam, setNewEventIsTeam] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchEvents = async () => {
    const { data } = await supabase.from('events').select('*').eq('competition_id', competitionId).order('id')
    setEvents(data || [])
  }

  useEffect(() => { fetchEvents() }, [competitionId])

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newEventName.trim()) return
    setLoading(true)
    const { error } = await supabase.from('events').insert({
      competition_id: competitionId,
      name: newEventName,
      calculation_rule: newEventRule,
      extra_fee: newEventExtraFee,
      is_team: newEventIsTeam,
    })
    setLoading(false)
    if (error) alert('添加失败：' + error.message)
    else {
      setNewEventName('')
      setNewEventRule('avg_of_3')
      setNewEventExtraFee(0)
      setNewEventIsTeam(false)
      fetchEvents()
    }
  }

  const handleDeleteEvent = async (id: number) => {
    if (!confirm('删除项目将同时删除相关报名和成绩，确定吗？')) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) alert('删除失败：' + error.message)
    else fetchEvents()
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">管理项目</h1>
      <form onSubmit={handleAddEvent} className="card p-6 mb-6">
        <div className="form-group">
          <label className="form-label">项目名称</label>
          <input type="text" className="form-input" value={newEventName} onChange={e => setNewEventName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label className="form-label">计算规则</label>
          <select className="form-select" value={newEventRule} onChange={e => setNewEventRule(e.target.value)}>
            <option value="avg_of_3">三次取平均</option>
            <option value="avg_of_5_trim">五次去最快最慢取平均</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">额外收费 (元)</label>
          <input type="number" step="0.01" className="form-input" value={newEventExtraFee} onChange={e => setNewEventExtraFee(parseFloat(e.target.value) || 0)} />
        </div>
        <label className="flex items-center gap-1 mb-4">
          <input type="checkbox" checked={newEventIsTeam} onChange={e => setNewEventIsTeam(e.target.checked)} />
          团队项目
        </label>
        <button type="submit" disabled={loading} className="btn btn-primary">添加项目</button>
      </form>

      <h2 className="text-lg font-semibold mb-4">现有项目</h2>
      {events.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">暂无项目</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-container">
            <table className="table">
              <thead>
                <tr><th>项目名称</th><th>规则</th><th>额外收费</th><th>团队项目</th><th>操作</th></tr>
              </thead>
              <tbody>
                {events.map(event => (
                  <tr key={event.id}>
                    <td>{event.name}</td>
                    <td>{event.calculation_rule === 'avg_of_3' ? '三次取平均' : '五次去最值平均'}</td>
                    <td>¥{event.extra_fee}</td>
                    <td>{event.is_team ? '是' : '否'}</td>
                    <td><button onClick={() => handleDeleteEvent(event.id)} className="text-red-600">删除</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <button onClick={() => router.push(`/admin/competitions/${competitionId}/results`)} className="btn btn-primary mt-6">下一步：上传成绩</button>
    </div>
  )
}