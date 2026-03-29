'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'

const FIXED_EVENTS = [
  '三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲',
  '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲'
]

// 工具栏按钮组件
const ToolbarButton = ({ onClick, active, children, title }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded text-sm ${active ? 'bg-gray-300' : 'hover:bg-gray-100'}`}
    title={title}
    dangerouslySetInnerHTML={{ __html: children }}
  />
)

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
  const editorRef = useRef<HTMLDivElement>(null)

  // 保存编辑器内容到 form.description
  const updateDescription = () => {
    if (editorRef.current) {
      setForm(prev => ({ ...prev, description: editorRef.current!.innerHTML }))
    }
  }

  useEffect(() => {
    // 初始化时清空编辑器
    if (editorRef.current) {
      editorRef.current.innerHTML = ''
    }
  }, [])

  // 执行命令
  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value || '')
    updateDescription()
    editorRef.current?.focus()
  }

  // 设置字体颜色
  const setColor = (color: string) => {
    execCommand('foreColor', color)
  }

  // 设置背景色
  const setBackground = (color: string) => {
    execCommand('backColor', color)
  }

  // 插入分割线
  const insertHr = () => {
    execCommand('insertHorizontalRule')
  }

  // 引用
  const insertBlockquote = () => {
    document.execCommand('formatBlock', false, 'blockquote')
    updateDescription()
    editorRef.current?.focus()
  }

  // 清除格式
  const removeFormat = () => {
    execCommand('removeFormat')
  }

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

        {/* 固定项目 */}
        <div className="form-group">
          <label className="form-label">固定项目 (可多选，可设置额外收费)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {FIXED_EVENTS.map(event => {
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

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? '创建中...' : '创建赛事'}
        </button>
      </form>
    </div>
  )
}