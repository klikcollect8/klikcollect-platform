import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin, handleRequireAdminError } from '@/lib/auth/require-admin'

export async function POST(request: NextRequest) {
  try {
    // Require head_admin role only
    const { user } = await requireAdmin(['head_admin'])
    
    const supabase = await createClient()

    const body = await request.json()
    const { userId, role } = body

    if (!userId || !role) {
      return NextResponse.json(
        { error: 'userId and role are required' },
        { status: 400 }
      )
    }

    // Security: Never trust userId from client - validate it's a valid UUID
    // The actual user ID will come from the database function, not the client
    if (typeof userId !== 'string' || !userId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      return NextResponse.json(
        { error: 'Invalid userId format' },
        { status: 400 }
      )
    }

    // Validate role
    const allowedRoles = ['user', 'editor', 'moderator', 'admin']
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Allowed roles: user, editor, moderator, admin' },
        { status: 400 }
      )
    }

    // Use the database function to assign role
    const { data, error } = await supabase.rpc('assign_user_role', {
      target_user_id: userId,
      new_role: role,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message || 'Failed to assign role' },
        { status: 500 }
      )
    }

    if (data && !data.success) {
      return NextResponse.json(
        { error: data.error || 'Failed to assign role' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Role assigned successfully',
    })
  } catch (error: any) {
    // Handle requireAdmin errors (401/403)
    if (error.status === 401 || error.status === 403) {
      return handleRequireAdminError(error) as NextResponse
    }
    
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: error.status || 500 }
    )
  }
}

