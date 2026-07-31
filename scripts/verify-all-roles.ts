/**
 * Comprehensive Role Verification Script
 * Checks Supabase database structure and role assignments
 * Run with: npx tsx scripts/verify-all-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  console.log('⚠️  Will use anon key (may be limited by RLS)');
}

const supabase = createClient(
  supabaseUrl,
  serviceRoleKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  serviceRoleKey ? {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  } : {}
);

const clientType = serviceRoleKey ? '🔐 ADMIN (Service Role - Bypasses RLS)' : '⚠️  REGULAR (Anon Key - Subject to RLS)';

console.log('\n' + '═'.repeat(80));
console.log('🔍 SUPABASE ROLE VERIFICATION');
console.log('═'.repeat(80));
console.log(`Client Type: ${clientType}\n`);

async function verifyRoles() {
  try {
    // 1. Check profiles table structure
    console.log('📊 1. Checking Profiles Table Structure...');
    console.log('─'.repeat(80));
    
    const { data: sampleProfile, error: sampleError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      console.error('❌ Error accessing profiles table:', sampleError.message);
      console.error('   Code:', sampleError.code);
      return;
    }

    if (sampleProfile) {
      console.log('✅ Profiles table exists and is accessible');
      console.log('   Columns:', Object.keys(sampleProfile).join(', '));
    } else {
      console.log('⚠️  Profiles table exists but is empty');
    }

    // 2. Get all profiles
    console.log('\n👥 2. Fetching All User Profiles...');
    console.log('─'.repeat(80));
    
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
      console.error('   Code:', profilesError.code);
      return;
    }

    if (!allProfiles || allProfiles.length === 0) {
      console.log('⚠️  No profiles found in database');
      console.log('   You need to create user profiles');
      return;
    }

    console.log(`✅ Found ${allProfiles.length} user profile(s)\n`);

    // 3. Role Distribution
    console.log('📈 3. Role Distribution:');
    console.log('─'.repeat(80));
    
    const expectedRoles = ['user', 'editor', 'moderator', 'admin', 'head_admin'];
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
          status: profile.status || 'active'
        });
      } else {
        console.warn(`⚠️  Invalid role found: "${role}" for user ${profile.email}`);
      }
    });

    expectedRoles.forEach(role => {
      const count = roleCounts[role];
      const icon = role === 'head_admin' ? '👑' : 
                   role === 'admin' ? '🛡️' : 
                   role === 'editor' ? '✏️' : 
                   role === 'moderator' ? '🔍' : '👤';
      console.log(`${icon} ${role.padEnd(15)}: ${count} user(s)`);
      if (count > 0 && roleUsers[role].length > 0) {
        roleUsers[role].forEach(user => {
          console.log(`   └─ ${user.email} (${user.status})`);
        });
      }
    });

    // 4. Admin Users Summary
    console.log('\n🔐 4. Admin Users Summary:');
    console.log('─'.repeat(80));
    const adminRoles = ['head_admin', 'admin', 'editor', 'moderator'];
    const adminUsers = allProfiles.filter(p => adminRoles.includes(p.role || ''));
    
    console.log(`Total Admin Users: ${adminUsers.length}`);
    adminUsers.forEach(user => {
      console.log(`   • ${user.email} (${user.role})`);
    });

    // 5. Regular Users
    console.log('\n👤 5. Regular Users:');
    console.log('─'.repeat(80));
    const regularUsers = allProfiles.filter(p => !p.role || p.role === 'user');
    console.log(`Total Regular Users: ${regularUsers.length}`);
    if (regularUsers.length > 0 && regularUsers.length <= 10) {
      regularUsers.forEach(user => {
        console.log(`   • ${user.email}`);
      });
    } else if (regularUsers.length > 10) {
      console.log(`   (Showing first 10 of ${regularUsers.length})`);
      regularUsers.slice(0, 10).forEach(user => {
        console.log(`   • ${user.email}`);
      });
    }

    // 6. Access Control Verification
    console.log('\n✅ 6. Access Control Verification:');
    console.log('─'.repeat(80));
    
    const accessMatrix = {
      'head_admin': ['Dashboard', 'Products', 'Orders', 'Reviews', 'Questions', 'Categories', 'Homepage', 'Role Management'],
      'admin': ['Dashboard', 'Products', 'Orders', 'Reviews', 'Questions', 'Categories', 'Homepage'],
      'editor': ['Dashboard', 'Products', 'Categories', 'Homepage'],
      'moderator': ['Dashboard', 'Reviews', 'Questions'],
      'user': ['Marketplace Only (No Admin Access)']
    };

    Object.entries(accessMatrix).forEach(([role, access]) => {
      const count = roleCounts[role];
      if (count > 0) {
        console.log(`\n${role}:`);
        access.forEach(feature => {
          console.log(`   ✅ ${feature}`);
        });
      }
    });

    // 7. Issues Found
    console.log('\n⚠️  7. Potential Issues:');
    console.log('─'.repeat(80));
    
    let issuesFound = false;
    
    if (roleCounts['head_admin'] === 0) {
      console.log('❌ No head_admin users found - you need at least one');
      issuesFound = true;
    }
    
    const invalidRoles = allProfiles.filter(p => p.role && !expectedRoles.includes(p.role));
    if (invalidRoles.length > 0) {
      console.log(`❌ Found ${invalidRoles.length} user(s) with invalid roles:`);
      invalidRoles.forEach(user => {
        console.log(`   • ${user.email}: "${user.role}" (should be one of: ${expectedRoles.join(', ')})`);
      });
      issuesFound = true;
    }
    
    const usersWithoutRoles = allProfiles.filter(p => !p.role);
    if (usersWithoutRoles.length > 0) {
      console.log(`⚠️  Found ${usersWithoutRoles.length} user(s) without roles (will default to 'user'):`);
      usersWithoutRoles.slice(0, 5).forEach(user => {
        console.log(`   • ${user.email}`);
      });
      if (usersWithoutRoles.length > 5) {
        console.log(`   ... and ${usersWithoutRoles.length - 5} more`);
      }
    }
    
    if (!issuesFound && usersWithoutRoles.length === 0) {
      console.log('✅ No issues found! All roles are properly assigned.');
    }

    // 8. Summary
    console.log('\n📋 8. Summary:');
    console.log('─'.repeat(80));
    console.log(`Total Users: ${allProfiles.length}`);
    console.log(`Admin Users: ${adminUsers.length}`);
    console.log(`Regular Users: ${regularUsers.length}`);
    console.log(`Head Admins: ${roleCounts['head_admin']}`);
    console.log(`Admins: ${roleCounts['admin']}`);
    console.log(`Editors: ${roleCounts['editor']}`);
    console.log(`Moderators: ${roleCounts['moderator']}`);
    
    console.log('\n' + '═'.repeat(80));
    console.log('✅ Verification Complete!');
    console.log('═'.repeat(80));
    console.log('\n💡 Next Steps:');
    console.log('   1. Ensure at least one user has head_admin role');
    console.log('   2. Assign appropriate roles to admin users');
    console.log('   3. Regular users should have role="user" or null');
    console.log('   4. Visit /api/debug/auth to check current user role');
    console.log('   5. Visit /admin to access admin panel (admin roles only)');
    
  } catch (error: any) {
    console.error('\n❌ Error during verification:', error.message);
    console.error(error.stack);
  }
}

verifyRoles();
