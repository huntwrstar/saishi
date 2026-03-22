'use client'
import { supabase } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import * as React from 'react'
import { v4 as uuidv4 } from 'uuid'

// 将时间字符串（如 "1:02.22" 或 "12.34"）转换为秒数
const parseTimeToSeconds = (timeStr: string): number => {
  const trimmed = timeStr.trim()
  if (trimmed === '') return NaN
  // 格式: mm:ss.ms 或 ss.ms
  const match = trimmed.match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/)
  if (!match) return parseFloat(trimmed)
  const minutes = match[1] ? parseInt(match[1], 10) : 0
  const seconds = parseFloat(match[2])
  return minutes * 60 + seconds
}

export default function UploadResults({ params }: { params: Promise<{ id: string }> }) {
  const { id: competitionId } = React.use(params)
  const [events, setEvents] = useState<any[]>([])
  const [selectedEvent, setSelectedEvent] = useState<number | null>(null)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set())
  const [groupResults, setGroupResults] = useState<{ [groupId: string]: string[] }>({})
  const [saving, setSaving] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<Record<number, boolean>>({})
  const [groupDataMap, setGroupDataMap] = useState<Map<string, { attemptData: string[]; average: number; best: number; calculation_rule: string }>>(new Map())
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    supabase
      .from('events')
      .select('*')
      .eq('competition_id', competitionId)
      .then(({ data }) => setEvents(data || []))
  }, [competitionId])

  useEffect(() => {
    if (!selectedEvent) return
    const fetchRegistrations = async () => {
      const { data: regs } = await supabase
        .from('registrations')
        .select(`
          id,
          user_id,
          status,
          profiles!inner (username, site_id)
        `)
        .eq('competition_id', competitionId)
        .eq('event_id', selectedEvent)
        .eq('status', 'registered')
      setRegistrations(regs || [])
      setSelectedUserIds(new Set())
      setGroupResults({})
      setSearchTerm('')

      if (!regs || regs.length === 0) return

      const regIds = regs.map(r => r.id)
      const { data: results } = await supabase
        .from('results')
        .select('*')
        .in('registration_id', regIds)

      const statusMap: Record<number, boolean> = {}
      results?.forEach(r => { statusMap[r.registration_id] = true })
      setUploadStatus(statusMap)

      const groupMap = new Map<string, { attemptData: string[]; average: number; best: number; calculation_rule: string }>()
      // 按 group_id 分组
      const groupResultsMap = new Map<string, any[]>()
      results?.forEach(r => {
        if (r.group_id) {
          if (!groupResultsMap.has(r.group_id)) groupResultsMap.set(r.group_id, [])
          groupResultsMap.get(r.group_id)!.push({ registration_id: r.registration_id, user_id: regs.find(reg => reg.id === r.registration_id)?.user_id, ...r })
        }
      })
      for (const [groupId, entries] of groupResultsMap.entries()) {
        const userIds = entries.map(e => e.user_id).filter(Boolean)
        const sortedUserIds = [...userIds].sort().join(',')
        const first = entries[0]
        groupMap.set(sortedUserIds, {
          attemptData: first.attempt_data,
          average: first.average,
          best: first.best,
          calculation_rule: first.calculation_rule,
        })
      }
      // 无 group_id 的个人成绩
      results?.forEach(r => {
        if (!r.group_id) {
          const reg = regs.find(reg => reg.id === r.registration_id)
          if (reg) {
            const key = reg.user_id
            groupMap.set(key, {
              attemptData: r.attempt_data,
              average: r.average,
              best: r.best,
              calculation_rule: r.calculation_rule,
            })
          }
        }
      })
      setGroupDataMap(groupMap)
    }
    fetchRegistrations()
  }, [selectedEvent, competitionId])

  const currentEvent = events.find(e => e.id === selectedEvent)
  const attemptCount = currentEvent ? (currentEvent.calculation_rule === 'avg_of_3' ? 3 : 5) : 0
  const activeGroupId = 'temp-group'

  useEffect(() => {
    if (selectedUserIds.size === 0) {
      setGroupResults(prev => ({ ...prev, [activeGroupId]: [] }))
      return
    }
    const sortedIds = Array.from(selectedUserIds).sort().join(',')
    const existing = groupDataMap.get(sortedIds)
    if (existing) {
      setGroupResults(prev => ({ ...prev, [activeGroupId]: existing.attemptData }))
    } else {
      setGroupResults(prev => ({ ...prev, [activeGroupId]: new Array(attemptCount).fill('') }))
    }
  }, [selectedUserIds, groupDataMap, attemptCount])

  const handleSelectUser = (userId: string) => {
    setSelectedUserIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(userId)) newSet.delete(userId)
      else newSet.add(userId)
      return newSet
    })
  }

  const handleGroupResultChange = (groupId: string, idx: number, value: string) => {
    setGroupResults(prev => ({
      ...prev,
      [groupId]: (prev[groupId] || []).map((v, i) => i === idx ? value : v)
    }))
  }

  const saveGroup = async () => {
    if (selectedUserIds.size === 0) {
      alert('请至少选择一名选手')
      return
    }
    const event = events.find(e => e.id === selectedEvent)
    if (!event) return
    const requiredCount = event.calculation_rule === 'avg_of_3' ? 3 : 5
    const rawInputs = groupResults[activeGroupId] || []
    // 将原始字符串转为秒数数组，用于计算
    const attempts = rawInputs.map(s => parseTimeToSeconds(s)).filter(v => !isNaN(v))
    if (attempts.length !== requiredCount) {
      alert(`请输入${requiredCount}个有效成绩（当前输入了${attempts.length}个有效时间）`)
      return
    }

    setSaving(true)
    let average: number
    if (event.calculation_rule === 'avg_of_3') {
      average = attempts.reduce((a, b) => a + b, 0) / 3
    } else {
      const sorted = [...attempts].sort((a, b) => a - b)
      const trimmed = sorted.slice(1, -1)
      average = trimmed.reduce((a, b) => a + b, 0) / trimmed.length
    }
    const best = Math.min(...attempts)
    const groupId = uuidv4()

    const selectedRegs = registrations.filter(reg => selectedUserIds.has(reg.user_id))
    const registrationIds = selectedRegs.map(reg => reg.id)

    // 删除旧成绩
    await supabase.from('results').delete().in('registration_id', registrationIds)

    // 插入新成绩，原始字符串数组存储
    const inserts = registrationIds.map(regId => ({
      registration_id: regId,
      attempt_data: rawInputs,
      calculation_rule: event.calculation_rule,
      average,
      best,
      group_id: groupId,
    }))

    const { error } = await supabase.from('results').insert(inserts)
    setSaving(false)
    if (error) {
      alert('保存失败：' + error.message)
    } else {
      alert('保存成功')
      const newStatus = { ...uploadStatus }
      registrationIds.forEach(id => { newStatus[id] = true })
      setUploadStatus(newStatus)
      const sortedIds = Array.from(selectedUserIds).sort().join(',')
      setGroupDataMap(prev => {
        const newMap = new Map(prev)
        newMap.set(sortedIds, { attemptData: rawInputs, average, best, calculation_rule: event.calculation_rule })
        return newMap
      })
    }
  }

  const filteredRegistrations = registrations.filter(reg => {
    const siteId = reg.profiles.site_id
    const username = reg.profiles.username
    const term = searchTerm.toLowerCase()
    return siteId.toLowerCase().includes(term) || username.toLowerCase().includes(term)
  })

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-xl font-bold mb-6">上传成绩</h1>
      <div className="form-group">
        <label className="form-label">选择项目：</label>
        <select
          className="form-select"
          value={selectedEvent || ''}
          onChange={e => setSelectedEvent(Number(e.target.value))}
        >
          <option value="">-- 请选择 --</option>
          {events.map(event => (
            <option key={event.id} value={event.id}>{event.name}</option>
          ))}
        </select>
      </div>

      {selectedEvent && registrations.length === 0 && (
        <div className="card p-6 text-center text-gray-500">暂无报名选手</div>
      )}

      {selectedEvent && registrations.length > 0 && (
        <>
          <div className="card p-6 mb-6">
            <div className="mb-4">
              <label className="form-label">搜索选手（网站ID / 姓名）</label>
              <input
                type="text"
                className="form-input"
                placeholder="输入网站ID或姓名..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <h2 className="text-lg font-semibold mb-4">选手列表（可多选组成队伍）</h2>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>选择</th>
                    <th>报名序号</th>
                    <th>选手姓名</th>
                    <th>状态</th>
                  </thead>
                <tbody>
                  {filteredRegistrations.map(reg => (
                    <tr key={reg.user_id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedUserIds.has(reg.user_id)}
                          onChange={() => handleSelectUser(reg.user_id)}
                        />
                      </td>
                       <td>{reg.profiles.site_id}</td>
                       <td>{reg.profiles.username}</td>
                       <td>
                        {uploadStatus[reg.id] ? (
                          <span className="text-green-600">已上传</span>
                        ) : (
                          <span className="text-gray-500">未上传</span>
                        )}
                       </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selectedUserIds.size > 0 && (
            <div className="card p-6">
              <h3 className="text-md font-semibold mb-4">为选中的选手输入成绩</h3>
              <div className="flex flex-wrap gap-2 mb-4">
                {[...Array(attemptCount)].map((_, i) => (
                  <input
                    key={i}
                    type="text"
                    placeholder={`第${i + 1}次成绩`}
                    className="form-input w-28"
                    value={(groupResults[activeGroupId] || [])[i] || ''}
                    onChange={e => {
                      const newInputs = [...(groupResults[activeGroupId] || new Array(attemptCount).fill(''))]
                      newInputs[i] = e.target.value
                      setGroupResults(prev => ({ ...prev, [activeGroupId]: newInputs }))
                    }}
                  />
                ))}
              </div>
              <button onClick={saveGroup} disabled={saving} className="btn btn-primary">
                {saving ? '保存中...' : '保存成绩（所选选手共用此成绩）'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}