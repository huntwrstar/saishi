'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import * as React from 'react'
import Link from 'next/link'

const ToolbarButton = ({ onClick, active, children, title }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded text-sm ${active ? 'bg-gray-300' : 'hover:bg-gray-100'}`}
    title={title}
    dangerouslySetInnerHTML={{ __html: children }}
  />
)

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
  const editorRef = useRef<HTMLDivElement>(null)

  const updateDescription = () => {
    if (editorRef.current) {
      setForm(prev => ({ ...prev, description: editorRef.current!.innerHTML }))
    }
  }

  useEffect(() => {
    if (editorRef.current && form.description) {
      editorRef.current.innerHTML = form.description
    }
  }, [form.description])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value || '')
    updateDescription()
    editorRef.current?.focus()
  }

  const setColor = (color: string) => execCommand('foreColor', color)
  const setBackground = (color: string) => execCommand('backColor', color)
  const insertHr = () => execCommand('insertHorizontalRule')
  const insertBlockquote = () => {
    document.execCommand('formatBlock', false, 'blockquote')
    updateDescription()
    editorRef.current?.focus()
  }
  const removeFormat = () => execCommand('removeFormat')

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
    const toLocal = (dateStr: string) => dateStr || null
    const { error } = await supabase
      .from('competitions')
      .update({
        name: form.name,
        datetime: toLocal(form.datetime),
        location: form.location,
        description: form.description,
        withdrawal_deadline: toLocal(form.withdrawal_deadline),
        registration_start: toLocal(form.registration_start),
        registration_end: toLocal(form.registration_end),
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

        {/* 富文本编辑器 */}
        <div className="form-group">
          <label className="form-label">介绍（关于比赛）</label>
          <div className="border border-gray-200 rounded-t bg-gray-50 p-2 flex flex-wrap gap-1">
            <ToolbarButton onClick={removeFormat} title="清除格式">🗑️</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('bold')} title="加粗"><strong>B</strong></ToolbarButton>
            <ToolbarButton onClick={() => execCommand('italic')} title="斜体"><em>I</em></ToolbarButton>
            <ToolbarButton onClick={() => execCommand('underline')} title="下划线"><u>U</u></ToolbarButton>
            <ToolbarButton onClick={() => execCommand('strikeThrough')} title="删除线"><s>S</s></ToolbarButton>
            <input type="color" onInput={(e) => setColor((e.target as HTMLInputElement).value)} className="w-6 h-6 p-0 border rounded cursor-pointer" title="字体颜色" />
            <input type="color" onInput={(e) => setBackground((e.target as HTMLInputElement).value)} className="w-6 h-6 p-0 border rounded cursor-pointer" title="背景颜色" />
            <ToolbarButton onClick={() => execCommand('insertUnorderedList')} title="项目编号">• 列表</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('insertOrderedList')} title="数字编号">1. 列表</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('outdent')} title="减少缩进">← 缩进</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('indent')} title="增加缩进">→ 缩进</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('justifyLeft')} title="左对齐">左</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('justifyCenter')} title="居中">中</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('justifyRight')} title="右对齐">右</ToolbarButton>
            <ToolbarButton onClick={() => execCommand('justifyFull')} title="两端对齐">两端</ToolbarButton>
            <ToolbarButton onClick={insertHr} title="分割线">—</ToolbarButton>
            <ToolbarButton onClick={insertBlockquote} title="引用">"</ToolbarButton>
          </div>
          <div
            ref={editorRef}
            contentEditable
            className="min-h-[300px] p-3 border border-gray-300 rounded-b bg-white focus:outline-none"
            onInput={updateDescription}
            dangerouslySetInnerHTML={{ __html: form.description }}
          />
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