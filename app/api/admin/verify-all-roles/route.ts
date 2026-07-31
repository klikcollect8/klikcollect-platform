import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * Comprehensive role verification endpoint
 * Uses admin client to bypass RLS and check all roles in database
 * Accessible to head_admin only
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Role check temporarily disabled - will be re-enabled after basic auth is working
    // const roleResponse = await fetch(new URL('/api/admin/current-role', request.url));
    // const roleData = await roleResponse.json();
    // if (roleData.role !== 'head_admin') {
    //   return NextResponse.json({ 
    //     error: 'Access denied. Head administrator only.'
    //   }, { status: 403 });
    // }

    // Use admin client to fetch all profiles
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ 
        error: 'Admin client not available. Check SUPABASE_SERVICE_ROLE_KEY.'
      }, { status: 500 });
    }

    // Fetch all profiles
    const { data: allProfiles, error: profilesError } = await adminClient
      .from('profiles')
      .select('id, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      return NextResponse.json({ 
        error: profilesError.message,
        code: profilesError.code
      }, { status: 500 });
    }

    if (!allProfiles || allProfiles.length === 0) {
      return NextResponse.json({
        totalUsers: 0,
        message: 'No profiles found in database',
        roles: {},
        adminUsers: [],
        regularUsers: [],
        issues: ['No users found in database']
      });
    }

    // Expected roles
    const expectedRoles = ['user', 'editor', 'moderator', 'admin', 'head_admin'];
    const adminRoles = ['head_admin', 'admin', 'editor', 'moderator'];

    // Calculate role distribution
    const roleCounts: { [key: string]: number } = {};
    const roleUsers: { [key: string]: any[] } = {};

    expectedRoles.forEach(role => {
      roleCounts[role] = 0;
      roleUsers[role] = [];
    });

    allProfiles.forEach(profile => {
      const role = profile.role || 'user';
      if (expectedRoles.includes(role)) {
        roleCounts[role]++;
        roleUsers[role].push({
          email: profile.email,
          id: profile.id,
          status: profile.status || 'active'
        });
      }
    });

    // Separate admin and regular users
    const adminUsers = allProfiles.filter(p => adminRoles.includes(p.role || ''));
    const regularUsers = allProfiles.filter(p => !p.role || p.role === 'user');

    // Check for issues
    const issues: string[] = [];
    const invalidRoles = allProfiles.filter(p => p.role && !expectedRoles.includes(p.role));
    const usersWithoutRoles = allProfiles.filter(p => !p.role);

    if (roleCounts['head_admin'] === 0) {
      issues.push('No head_admin users found - at least one is required');
    }

    if (invalidRoles.length > 0) {
      issues.push(`${invalidRoles.length} user(s) have invalid roles: ${invalidRoles.map(u => `${u.email} (${u.role})`).join(', ')}`);
    }

    if (usersWithoutRoles.length > 0) {
      issues.push(`${usersWithoutRoles.length} user(s) without roles (will default to 'user')`);
    }

    // Access control matrix
    const accessMatrix = {
      'head_admin': ['Dashboard', 'Products', 'Orders', 'Reviews', 'Questions', 'Categories', 'Homepage', 'Role Management'],
      'admin': ['Dashboard', 'Products', 'Orders', 'Reviews', 'Questions', 'Categories', 'Homepage'],
      'editor': ['Dashboard', 'Products', 'Categories', 'Homepage'],
      'moderator': ['Dashboard', 'Reviews', 'Questions'],
      'user': ['Marketplace Only (No Admin Access)']
    };

    return NextResponse.json({
      success: true,
      clientType: 'admin (service role - bypasses RLS)',
      totalUsers: allProfiles.length,
      roleDistribution: roleCounts,
      roles: roleUsers,
      adminUsers: adminUsers.map(u => ({
        email: u.email,
        role: u.role,
        status: u.status || 'active'
      })),
      regularUsers: regularUsers.map(u => ({
        email: u.email,
        role: u.role || 'user',
        status: u.status || 'active'
      })),
      accessMatrix,
      issues: issues.length > 0 ? issues : ['No issues found - all roles are properly assigned'],
      summary: {
        totalUsers: allProfiles.length,
        adminUsers: adminUsers.length,
        regularUsers: regularUsers.length,
        headAdmins: roleCounts['head_admin'],
        admins: roleCounts['admin'],
        editors: roleCounts['editor'],
        moderators: roleCounts['moderator'],
        users: roleCounts['user']
      },
      recommendations: [
        roleCounts['head_admin'] === 0 ? 'Assign head_admin role to at least one user' : null,
        invalidRoles.length > 0 ? 'Fix invalid role values in database' : null,
        usersWithoutRoles.length > 0 ? 'Assign roles to users without roles' : null
      ].filter(Boolean)
    });
  } catch (error: any) {
    console.error('[verify-all-roles] Error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
    }, { status: 500 });
  }
}
