'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as React from 'react'
import Link from 'next/link'

export default function EditCompetition({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: competitionId } = React.use(params)
  const [form, setForm] = useState({
    name: '',
    datetime: '',
    location: '',
    description: '',
    withdrawal_deadline: '',
    registration_start: '',
    registration_end: '',
    base_fee: 0,
  })
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .single()
      .then(({ data }) => {
        if (data) {
          setForm({
            name: data.name,
            datetime: data.datetime.slice(0, 16),
            location: data.location,
            description: data.description || '',
            withdrawal_deadline: data.withdrawal_deadline ? data.withdrawal_deadline.slice(0, 16) : '',
            registration_start: data.registration_start ? data.registration_start.slice(0, 16) : '',
            registration_end: data.registration_end ? data.registration_end.slice(0, 16) : '',
            base_fee: data.base_fee || 0,
          })
        }
        setFetching(false)
      })
  }, [competitionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const toLocal = (dateStr: string) => dateStr || null;
    const { error } = await supabase
      .from('competitions')
      .update({
        name: form.name,
        datetime: toISO(form.datetime),
        location: form.location,
        description: form.description,
        withdrawal_deadline: toISO(form.withdrawal_deadline),
        registration_start: toISO(form.registration_start),
        registration_end: toISO(form.registration_end),
        base_fee: form.base_fee,
      })
      .eq('id', competitionId)
    setLoading(false)
    if (error) {
      alert('更新失败：' + error.message)
    } else {
      alert('更新成功')
      router.push('/admin/competitions')
    }
  }

  if (fetching) return <div className="text-center py-8">加载中...</div>

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">编辑赛事</h1>
      <form onSubmit={handleSubmit} className="card p-6">
        <div className="form-group">
          <label className="form-label">赛事名称</label>
          <input type="text" className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="form-group">
          <label className="form-label">时间</label>
          <input type="datetime-local" className="form-input" value={form.datetime} onChange={e => setForm({ ...form, datetime: e.target.value })} required />
        </div>
        <div className="form-group">
          <label className="form-label">地点</label>
          <input type="text" className="form-input" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} required />
        </div>
        <div className="form-group">
          <label className="form-label">介绍（关于比赛）</label>
          <textarea className="form-textarea" rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">基础报名费 (元)</label>
          <input type="number" step="0.01" className="form-input" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="form-group">
          <label className="form-label">报名开始时间</label>
          <input type="datetime-local" className="form-input" value={form.registration_start} onChange={e => setForm({ ...form, registration_start: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">报名结束时间</label>
          <input type="datetime-local" className="form-input" value={form.registration_end} onChange={e => setForm({ ...form, registration_end: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">退赛截止时间</label>
          <input type="datetime-local" className="form-input" value={form.withdrawal_deadline} onChange={e => setForm({ ...form, withdrawal_deadline: e.target.value })} />
        </div>

        <Link href={`/admin/competitions/${competitionId}/events`} className="btn btn-outline block text-center mb-4">
          管理项目（包含费用）
        </Link>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? '保存中...' : '保存修改'}
        </button>
      </form>
    </div>
  )
}