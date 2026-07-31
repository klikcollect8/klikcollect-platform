import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, email } = body;

    if (!userId && !email) {
      return NextResponse.json({ error: 'userId or email required' }, { status: 400 });
    }

    // Use admin client for profile lookup (bypasses RLS)
    const adminClient = createAdminClient();
    const supabase = adminClient || await createClient();
    
    const clientType = adminClient ? 'admin (service role)' : 'regular (anon key)';
    
    let profile = null;
    let profileError = null;

    // Try by ID first if provided
    if (userId) {
      const { data: profileById, error: errorById } = await supabase
        .from('profiles')
        .select('id, email, role, status')
        .eq('id', userId)
        .single();

      if (profileById && !errorById) {
        profile = profileById;
      } else {
        profileError = errorById;
      }
    }

    // Fallback to email if ID lookup failed or email provided
    if (!profile && email) {
      const { data: profileByEmail, error: errorByEmail } = await supabase
        .from('profiles')
        .select('id, email, role, status')
        .eq('email', email)
        .single();
      
      if (profileByEmail && !errorByEmail) {
        profile = profileByEmail;
      } else {
        profileError = errorByEmail || profileError;
      }
    }

    if (!profile) {
      return NextResponse.json({
        found: false,
        error: profileError?.message || 'Profile not found',
        errorCode: profileError?.code,
        clientType,
      }, { status: 404 });
    }

    const isAdmin = ['head_admin', 'admin', 'editor', 'moderator'].includes(profile.role);

    return NextResponse.json({
      found: true,
      profile: {
        id: profile.id,
        email: profile.email,
        role: profile.role,
        status: profile.status,
      },
      isAdmin,
      allowedRoles: ['head_admin', 'admin', 'editor', 'moderator'],
      clientType,
    });
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
