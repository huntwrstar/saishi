'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

const FIXED_EVENTS = [
  '三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲',
  '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲'
]

export default function NewCompetition() {
  const router = useRouter()
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
    const { data: competition, error: compError } = await supabase
      .from('competitions')
      .insert({
        name: form.name,
        datetime: toLocal(form.datetime),
        location: form.location,
        description: form.description,
        withdrawal_deadline: toLocal(form.withdrawal_deadline),
        registration_start: toLocal(form.registration_start),
        registration_end: toLocal(form.registration_end),
        base_fee: form.base_fee,
      })
      .select()
      .single()

    if (compError) {
      alert('创建赛事失败：' + compError.message)
      setLoading(false)
      return
    }

    const fixedEventsToInsert = selectedFixedEvents.map(event => ({
      competition_id: competition.id,
      name: event.name,
      calculation_rule: 'avg_of_5_trim',
      extra_fee: event.extra_fee,
      is_team: false,
    }))

    const customEventsToInsert = customEvents.map(ce => ({
      competition_id: competition.id,
      name: ce.name,
      calculation_rule: ce.rule,
      extra_fee: ce.extra_fee,
      is_team: ce.is_team,
    }))

    const { error: eventsError } = await supabase
      .from('events')
      .insert([...fixedEventsToInsert, ...customEventsToInsert])

    if (eventsError) {
      alert('创建项目失败：' + eventsError.message)
    } else {
      alert('创建成功')
      router.push('/admin/competitions')
    }
    setLoading(false)
  }

  return (
    <div className="container py-8 max-w-2xl">
      <h1 className="text-xl font-bold mb-6">新建赛事</h1>
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

        {/* 其余字段保持不变 */}
        <div className="form-group">
          <label className="form-label">基础报名费 (元)</label>
          <input type="number" step="0.01" className="form-input" value={form.base_fee} onChange={e => setForm({ ...form, base_fee: parseFloat(e.target.value) || 0 })} />
        </div>
        {/* ... 报名开始、结束、退赛截止、固定项目、自定义项目等（与之前相同，省略重复） */}
        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? '创建中...' : '创建赛事'}
        </button>
      </form>
    </div>
  )
}