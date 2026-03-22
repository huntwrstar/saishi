import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request, { params }: { params: { competitionId: string } }) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }

  const formData = await request.formData()
  const eventId = formData.get('eventId') as string

  // 检查是否已报名（包括退赛的）
  const { data: existing } = await supabase
    .from('registrations')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('competition_id', params.competitionId)
    .eq('event_id', eventId)
    .single()

  if (existing && existing.status === 'withdrawn') {
    // 重新报名：更新状态
    await supabase
      .from('registrations')
      .update({ status: 'registered', withdrawn_at: null })
      .eq('id', existing.id)
  } else if (!existing) {
    // 新报名
    await supabase
      .from('registrations')
      .insert({
        user_id: user.id,
        competition_id: params.competitionId,
        event_id: eventId,
        status: 'registered',
      })
  }

  return NextResponse.redirect(new URL(`/competitions/${params.competitionId}`, request.url))
}