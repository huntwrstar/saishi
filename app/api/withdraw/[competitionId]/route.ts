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
  const registrationId = formData.get('registrationId') as string

  // 检查退赛截止日期
  const { data: competition } = await supabase
    .from('competitions')
    .select('withdrawal_deadline')
    .eq('id', params.competitionId)
    .single()

  if (competition?.withdrawal_deadline && new Date() > new Date(competition.withdrawal_deadline)) {
    // 已过退赛截止日期，不允许退赛
    return NextResponse.redirect(new URL(`/competitions/${params.competitionId}?error=withdrawal_deadline_passed`, request.url))
  }

  await supabase
    .from('registrations')
    .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
    .eq('id', registrationId)

  return NextResponse.redirect(new URL(`/competitions/${params.competitionId}`, request.url))
}