/**
 * Script to check and fix admin role alignment between codebase and database
 * Run with: npx tsx scripts/check-admin-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment variables');
  console.log('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function checkAdminRoles() {
  console.log('🔍 Checking admin roles in database...\n');

  // Get all profiles
  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, role, status')
    .order('role', { ascending: true });

  if (error) {
    console.error('❌ Error fetching profiles:', error);
    return;
  }

  if (!profiles || profiles.length === 0) {
    console.log('⚠️  No profiles found in database');
    return;
  }

  console.log(`📊 Found ${profiles.length} profiles\n`);

  // Expected roles
  const expectedRoles = ['user', 'editor', 'moderator', 'admin', 'head_admin'];
  const adminRoles = ['head_admin', 'admin', 'editor', 'moderator'];

  // Group by role
  const roleGroups: { [key: string]: any[] } = {};
  profiles.forEach(profile => {
    const role = profile.role || 'unknown';
    if (!roleGroups[role]) {
      roleGroups[role] = [];
    }
    roleGroups[role].push(profile);
  });

  // Display role statistics
  console.log('📈 Role Distribution:');
  console.log('─'.repeat(50));
  expectedRoles.forEach(role => {
    const count = roleGroups[role]?.length || 0;
    const isAdmin = adminRoles.includes(role);
    const icon = isAdmin ? '🔐' : '👤';
    console.log(`${icon} ${role.padEnd(15)}: ${count} users`);
  });
  if (roleGroups['unknown']) {
    console.log(`⚠️  unknown${' '.repeat(11)}: ${roleGroups['unknown'].length} users (no role set)`);
  }
  console.log('─'.repeat(50));
  console.log('');

  // List admin users
  const adminUsers = profiles.filter(p => adminRoles.includes(p.role || ''));
  console.log(`🔐 Admin Users (${adminUsers.length}):`);
  console.log('─'.repeat(50));
  if (adminUsers.length === 0) {
    console.log('⚠️  No admin users found!');
  } else {
    adminUsers.forEach(user => {
      console.log(`  • ${user.email} (${user.role}) - Status: ${user.status || 'active'}`);
    });
  }
  console.log('─'.repeat(50));
  console.log('');

  // Check for invalid roles
  const invalidRoles = profiles.filter(p => 
    p.role && !expectedRoles.includes(p.role)
  );
  if (invalidRoles.length > 0) {
    console.log('⚠️  Users with invalid roles:');
    invalidRoles.forEach(user => {
      console.log(`  • ${user.email}: "${user.role}" (should be one of: ${expectedRoles.join(', ')})`);
    });
    console.log('');
  }

  // Check for users without roles
  const noRole = profiles.filter(p => !p.role || p.role === 'unknown');
  if (noRole.length > 0) {
    console.log('⚠️  Users without roles:');
    noRole.forEach(user => {
      console.log(`  • ${user.email} (ID: ${user.id})`);
    });
    console.log('');
  }

  // Summary
  console.log('📋 Summary:');
  console.log(`  Total profiles: ${profiles.length}`);
  console.log(`  Admin users: ${adminUsers.length}`);
  console.log(`  Regular users: ${roleGroups['user']?.length || 0}`);
  console.log(`  Invalid roles: ${invalidRoles.length}`);
  console.log(`  Missing roles: ${noRole.length}`);
}

checkAdminRoles().catch(console.error);
