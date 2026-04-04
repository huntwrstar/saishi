'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as React from 'react'

const ROUNDS = [
  { value: 1, label: '初赛' },
  { value: 2, label: '复赛' },
  { value: 3, label: '半决赛' },
  { value: 4, label: '决赛' },
]

// 固定项目名称列表（可多选添加）
const FIXED_NAMES = [
  '三阶', '二阶', '四阶', '五阶', '六阶', '七阶', '最少步', '三单', '三盲',
  '魔表', '金字塔', '斜转', '五魔方', 'SQ1', '四盲', '五盲', '多盲'
]

export default function ManageEvents({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const { id: competitionId } = React.use(params)
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showFixedModal, setShowFixedModal] = useState(false)
  const [selectedFixed, setSelectedFixed] = useState<string[]>([])
  const [fixedExtraFee, setFixedExtraFee] = useState(0)
  const [fixedRounds, setFixedRounds] = useState<number[]>([1,2,3,4])
  const [fixedIsTeam, setFixedIsTeam] = useState(false)
  const [addingFixed, setAddingFixed] = useState(false)

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('competition_id', competitionId)
      .order('id')
    setEvents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetchEvents()
  }, [competitionId])

  const startEdit = (event: any) => {
    setEditingId(event.id)
    setEditForm({
      name: event.name,
      calculation_rule: event.calculation_rule,
      extra_fee: event.extra_fee,
      is_team: event.is_team,
      rounds: event.rounds || [1,2,3,4],
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditForm({})
  }

  const updateRoundSelection = (roundValue: number, checked: boolean) => {
    let newRounds = [...(editForm.rounds || [])]
    if (checked) {
      if (!newRounds.includes(roundValue)) newRounds.push(roundValue)
    } else {
      newRounds = newRounds.filter(r => r !== roundValue)
    }
    newRounds.sort((a,b) => a-b)
    setEditForm({ ...editForm, rounds: newRounds })
  }

  const saveEdit = async () => {
    setSaving(true)
    const { error } = await supabase
      .from('events')
      .update({
        name: editForm.name,
        calculation_rule: editForm.calculation_rule,
        extra_fee: editForm.extra_fee,
        is_team: editForm.is_team,
        rounds: editForm.rounds,
      })
      .eq('id', editingId)
    setSaving(false)
    if (error) {
      alert('保存失败：' + error.message)
    } else {
      alert('保存成功')
      setEditingId(null)
      fetchEvents()
    }
  }

  const handleDeleteEvent = async (id: number, name: string) => {
    if (!confirm(`确定要删除项目“${name}”吗？该项目下的所有报名和成绩也将被删除，不可恢复。`)) return
    const { error } = await supabase.from('events').delete().eq('id', id)
    if (error) {
      alert('删除失败：' + error.message)
    } else {
      fetchEvents()
    }
  }

  // 添加自定义项目（弹窗方式）
  const handleAddCustomEvent = async () => {
    const newName = prompt('请输入新项目名称')
    if (!newName) return
    const newRule = confirm('是否使用“五次去最快最慢取平均”规则？\n确定=五次去最值，取消=三次取平均')
    const calculation_rule = newRule ? 'avg_of_5_trim' : 'avg_of_3'
    const extra_fee = parseFloat(prompt('额外收费金额 (元)', '0') || '0')
    const isTeam = confirm('是否为团队项目？')
    const rounds = [1,2,3,4] // 默认全部轮次，后续可编辑

    const { error } = await supabase.from('events').insert({
      competition_id: competitionId,
      name: newName,
      calculation_rule,
      extra_fee,
      is_team: isTeam,
      rounds,
    })
    if (error) {
      alert('添加失败：' + error.message)
    } else {
      fetchEvents()
    }
  }

  // 打开添加固定项目的模态框
  const openFixedModal = () => {
    setSelectedFixed([])
    setFixedExtraFee(0)
    setFixedRounds([1,2,3,4])
    setFixedIsTeam(false)
    setShowFixedModal(true)
  }

  // 提交添加固定项目
  const submitFixedEvents = async () => {
    if (selectedFixed.length === 0) {
      alert('请至少选择一个固定项目')
      return
    }
    setAddingFixed(true)
    // 过滤掉已经存在的固定项目（避免重复添加）
    const existingNames = events.map(e => e.name)
    const toAdd = selectedFixed.filter(name => !existingNames.includes(name))
    if (toAdd.length === 0) {
      alert('所选项目均已存在，无需重复添加')
      setAddingFixed(false)
      setShowFixedModal(false)
      return
    }
    const inserts = toAdd.map(name => ({
      competition_id: competitionId,
      name,
      calculation_rule: 'avg_of_5_trim', // 固定项目默认规则
      extra_fee: fixedExtraFee,
      is_team: fixedIsTeam,
      rounds: fixedRounds,
    }))
    const { error } = await supabase.from('events').insert(inserts)
    setAddingFixed(false)
    if (error) {
      alert('添加失败：' + error.message)
    } else {
      alert(`成功添加 ${toAdd.length} 个固定项目`)
      setShowFixedModal(false)
      fetchEvents()
    }
  }

  const toggleFixedSelection = (name: string) => {
    setSelectedFixed(prev =>
      prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
    )
  }

  const updateFixedRounds = (roundValue: number, checked: boolean) => {
    let newRounds = [...fixedRounds]
    if (checked) {
      if (!newRounds.includes(roundValue)) newRounds.push(roundValue)
    } else {
      newRounds = newRounds.filter(r => r !== roundValue)
    }
    newRounds.sort((a,b) => a-b)
    setFixedRounds(newRounds)
  }

  if (loading) return <div className="text-center py-8">加载中...</div>

  return (
    <div className="container py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">管理项目</h1>
        <div className="space-x-2">
          <button onClick={openFixedModal} className="btn btn-primary">
            添加固定项目
          </button>
          <button onClick={handleAddCustomEvent} className="btn btn-outline">
            添加自定义项目
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="card p-6 text-center text-gray-500">暂无项目，请添加</div>
      ) : (
        <div className="space-y-4">
          {events.map(event => {
            const isFixed = FIXED_NAMES.includes(event.name)
            const isEditing = editingId === event.id
            if (isEditing) {
              return (
                <div key={event.id} className="card p-4 border border-blue-300 bg-blue-50">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1">项目名称</label>
                      {isFixed ? (
                        <input type="text" className="form-input bg-gray-100" value={editForm.name} disabled />
                      ) : (
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.name}
                          onChange={e => setEditForm({...editForm, name: e.target.value})}
                        />
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">计算规则</label>
                      <select
                        className="form-select"
                        value={editForm.calculation_rule}
                        onChange={e => setEditForm({...editForm, calculation_rule: e.target.value})}
                      >
                        <option value="avg_of_3">三次取平均</option>
                        <option value="avg_of_5_trim">五次去最快最慢取平均</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">额外收费 (元)</label>
                      <input
                        type="number"
                        step="0.01"
                        className="form-input"
                        value={editForm.extra_fee}
                        onChange={e => setEditForm({...editForm, extra_fee: parseFloat(e.target.value) || 0})}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={editForm.is_team}
                          onChange={e => setEditForm({...editForm, is_team: e.target.checked})}
                        />
                        团队项目
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">轮次（可多选）</label>
                      <div className="flex gap-3">
                        {ROUNDS.map(r => (
                          <label key={r.value} className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={editForm.rounds?.includes(r.value) || false}
                              onChange={(e) => updateRoundSelection(r.value, e.target.checked)}
                            />
                            {r.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} disabled={saving} className="btn btn-primary">
                        {saving ? '保存中...' : '保存'}
                      </button>
                      <button onClick={cancelEdit} className="btn btn-outline">取消</button>
                    </div>
                  </div>
                </div>
              )
            }
            // 非编辑状态
            return (
              <div key={event.id} className="card p-4 flex flex-wrap justify-between items-center">
                <div>
                  <h3 className="font-semibold">{event.name}</h3>
                  <div className="text-sm text-gray-500 mt-1">
                    <span>规则：{event.calculation_rule === 'avg_of_3' ? '三次取平均' : '五次去最值取平均'}</span>
                    {event.extra_fee > 0 && <span className="ml-2">额外收费 ¥{event.extra_fee}</span>}
                    {event.is_team && <span className="ml-2">团队项目</span>}
                    <div className="mt-1">
                      轮次：{(event.rounds || [1,2,3,4]).map((r: number) => ROUNDS.find(ro => ro.value === r)?.label || `第${r}轮`).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => startEdit(event)} className="btn btn-outline text-sm">编辑</button>
                  <button onClick={() => handleDeleteEvent(event.id, event.name)} className="btn btn-danger text-sm">删除</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 添加固定项目的模态框 */}
      {showFixedModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full max-h-[80vh] overflow-auto">
            <h2 className="text-xl font-bold mb-4">添加固定项目</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">选择项目（可多选）</label>
              <div className="grid grid-cols-2 gap-2">
                {FIXED_NAMES.map(name => {
                  const alreadyExists = events.some(e => e.name === name)
                  return (
                    <label key={name} className={`flex items-center gap-1 ${alreadyExists ? 'text-gray-400' : ''}`}>
                      <input
                        type="checkbox"
                        value={name}
                        checked={selectedFixed.includes(name)}
                        onChange={() => toggleFixedSelection(name)}
                        disabled={alreadyExists}
                      />
                      {name} {alreadyExists && '(已存在)'}
                    </label>
                  )
                })}
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">额外收费 (元)</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={fixedExtraFee}
                onChange={e => setFixedExtraFee(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={fixedIsTeam}
                  onChange={e => setFixedIsTeam(e.target.checked)}
                />
                团队项目
              </label>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">轮次（可多选）</label>
              <div className="flex gap-3">
                {ROUNDS.map(r => (
                  <label key={r.value} className="flex items-center gap-1">
                    <input
                      type="checkbox"
                      checked={fixedRounds.includes(r.value)}
                      onChange={(e) => updateFixedRounds(r.value, e.target.checked)}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowFixedModal(false)} className="btn btn-outline">取消</button>
              <button onClick={submitFixedEvents} disabled={addingFixed} className="btn btn-primary">
                {addingFixed ? '添加中...' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}