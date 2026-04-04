'use client'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import * as React from 'react'
import Link from 'next/link'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'

const FONT_SIZES = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px']

const ToolbarButton = ({ onClick, active, children, title }: any) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2 py-1 rounded-md text-sm font-medium transition-colors duration-200 ${
      active
        ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-500'
        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
    }`}
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
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '输入比赛介绍，支持富文本格式...' }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
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

  useEffect(() => {
    if (editor && form.description) {
      editor.commands.setContent(form.description)
    }
  }, [editor, form.description])

  useEffect(() => {
    supabase
      .from('competitions')
      .select('*')
      .eq('id', competitionId)
      .maybeSingle()
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

  const setFontSize = (size: string) => {
    if (!editor) return
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run()
  }

  const setColor = (color: string) => {
    if (!editor) return
    editor.chain().focus().setColor(color).run()
  }

  const setHighlight = (color: string) => {
    if (!editor) return
    editor.chain().focus().setHighlight({ color }).run()
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
          {editor && (
            <div className="border border-gray-200 rounded-t bg-gray-50 p-2 flex flex-wrap gap-1.5">
              <select
                className="px-2 py-1 rounded-md text-sm bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                onChange={(e) => setFontSize(e.target.value)}
                defaultValue=""
              >
                <option value="">字号</option>
                {FONT_SIZES.map(size => <option key={size} value={size}>{size}</option>)}
              </select>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')}><strong>B</strong></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')}><em>I</em></ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')}><s>S</s></ToolbarButton>
              <input type="color" onInput={(e) => setColor((e.target as HTMLInputElement).value)} className="w-7 h-7 p-0 border rounded cursor-pointer" title="字体颜色" />
              <input type="color" onInput={(e) => setHighlight((e.target as HTMLInputElement).value)} className="w-7 h-7 p-0 border rounded cursor-pointer" title="背景颜色" />
              <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')}>• 列表</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')}>1. 列表</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()}>—</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')}>"</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })}>左</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })}>中</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })}>右</ToolbarButton>
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

        {/* 提示：修改项目请前往管理项目页面 */}
        <div className="mt-4 mb-4 p-3 bg-blue-50 text-blue-800 rounded-md text-sm">
          提示：如需修改比赛项目（添加/删除/修改项目、设置轮次等），请点击下方“管理项目”按钮。
        </div>

        <Link href={`/admin/competitions/${competitionId}/events`} className="btn btn-outline block text-center mb-4">
          管理项目
        </Link>

        <button type="submit" disabled={loading} className="btn btn-primary w-full">
          {loading ? '保存中...' : '保存修改'}
        </button>
      </form>
    </div>
  )
}