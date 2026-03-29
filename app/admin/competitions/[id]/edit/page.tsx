'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as React from 'react'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

const ToolbarButton = ({ onClick, active, children, title }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded text-sm ${active ? 'bg-gray-300' : 'hover:bg-gray-100'}`}
    title={title}
  >
    {children}
  </button>
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
  const [selectedFixedEvents, setSelectedFixedEvents] = useState<{ name: string; extra_fee: number }[]>([])
  const [customEvents, setCustomEvents] = useState<{ name: string; rule: string; extra_fee: number; is_team: boolean }[]>([])
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '输入比赛介绍，支持富文本格式...' }),
    ],
    content: form.description,
    onUpdate: ({ editor }) => {
      setForm(prev => ({ ...prev, description: editor.getHTML() }))
    },
    editorProps: {
      attributes: {
        class: 'min-h-[300px] p-3 border border-gray-300 rounded bg-white focus:outline-none',
      },
    },
  })

  // 当从数据库加载的描述变化时，同步到编辑器
  useEffect(() => {
    if (editor && form.description) {
      editor.commands.setContent(form.description)
    }
  }, [editor, form.description])

  // 加载赛事数据
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
          // 加载固定项目（需要从 events 表查询，但本页面不直接管理项目，可忽略）
          // 加载自定义项目同理，通过独立的管理页面处理。
        }
        setFetching(false)
      })
  }, [competitionId])

  const handleFixedEventToggle = (event: { name: string; extra_fee: number }) => {
    setSelectedFixedEvents(prev => {
      const exists = prev.some(e => e.name === event.name)
      if (exists) return prev.filter(e => e.name !== event.name)
      return [...prev, { ...event }]
    })
  }

  const updateFixedEventFee = (eventName: string, fee: number) => {
    setSelectedFixedEvents(prev =>
      prev.map(e => e.name === eventName ? { ...e, extra_fee: fee } : e)
    )
  }

  const addCustomEvent = () => {
    setCustomEvents([...customEvents, { name: '', rule: 'avg_of_3', extra_fee: 0, is_team: false }])
  }

  const updateCustomEvent = (index: number, field: string, value: any) => {
    const updated = [...customEvents]
    updated[index] = { ...updated[index], [field]: value }
    setCustomEvents(updated)
  }

  const removeCustomEvent = (index: number) => {
    setCustomEvents(customEvents.filter((_, i) => i !== index))
  }

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
          {editor && (
            <div className="border border-gray-200 rounded-t bg-gray-50 p-2 flex flex-wrap gap-1">
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}>
                <strong>B</strong>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}>
                <em>I</em>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}>
                <s>S</s>
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>
                • 列表
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>
                1. 列表
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>
                —
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>
                "
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>
                左
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>
                中
              </ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>
                右
              </ToolbarButton>
            </div>
          )}
          <EditorContent editor={editor} />
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

        {/* 固定项目 */}
        <div className="form-group">
          <label className="form-label">固定项目 (可多选，可设置额外收费)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {['三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲', '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲'].map(event => {
              const isSelected = selectedFixedEvents.some(e => e.name === event)
              return (
                <div key={event} className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleFixedEventToggle({ name: event, extra_fee: 0 })}
                    />
                    {event}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="额外收费"
                    className="w-20 px-1 py-0.5 text-sm border rounded"
                    value={selectedFixedEvents.find(e => e.name === event)?.extra_fee ?? 0}
                    onChange={e => updateFixedEventFee(event, parseFloat(e.target.value) || 0)}
                    disabled={!isSelected}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* 自定义项目 */}
        <div className="form-group">
          <label className="form-label">自定义项目</label>
          <button type="button" onClick={addCustomEvent} className="btn btn-outline mb-2">添加自定义项目</button>
          {customEvents.map((ce, idx) => (
            <div key={idx} className="border border-gray-200 p-4 rounded mb-2">
              <input type="text" placeholder="项目名称" className="form-input mb-2" value={ce.name} onChange={e => updateCustomEvent(idx, 'name', e.target.value)} required />
              <select className="form-select mb-2" value={ce.rule} onChange={e => updateCustomEvent(idx, 'rule', e.target.value)}>
                <option value="avg_of_3">三次取平均</option>
                <option value="avg_of_5_trim">五次去最快最慢取平均</option>
              </select>
              <input type="number" step="0.01" placeholder="额外收费" className="form-input mb-2" value={ce.extra_fee} onChange={e => updateCustomEvent(idx, 'extra_fee', parseFloat(e.target.value) || 0)} />
              <label className="flex items-center gap-1 mb-2">
                <input type="checkbox" checked={ce.is_team} onChange={e => updateCustomEvent(idx, 'is_team', e.target.checked)} />
                团队项目
              </label>
              <button type="button" onClick={() => removeCustomEvent(idx)} className="btn btn-danger text-sm">删除</button>
            </div>
          ))}
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