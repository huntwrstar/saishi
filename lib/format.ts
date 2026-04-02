export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('zh-CN').replace(/\//g, '-')
}

export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleString('zh-CN').replace(/\//g, '-')
}