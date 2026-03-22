import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: { user } } = await supabase.auth.getUser()

  // 检查管理员权限（这里简单检查 app_metadata 中的 role）
  const isAdmin = user?.app_metadata?.role === 'admin'
  if (!isAdmin) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = await request.json()
  const { name, datetime, location, description, withdrawal_deadline } = body

  const { error } = await supabase
    .from('competitions')
    .insert({
      name,
      datetime,
      location,
      description,
      withdrawal_deadline: withdrawal_deadline || null,
    })

  if (error) {
    return new NextResponse(error.message, { status: 500 })
  }

  return new NextResponse('OK', { status: 200 })
}