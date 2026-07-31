/**
 * Comprehensive Supabase Database Verification Script
 * Checks profiles table, roles, and access control setup
 * Run with: npx tsx scripts/verify-supabase-roles.ts
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Missing Supabase environment variables');
  console.log('Required:');
  console.log('  - NEXT_PUBLIC_SUPABASE_URL');
  console.log('  - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function verifySupabase() {
  console.log('🔍 Verifying Supabase Database Setup...\n');
  console.log('═'.repeat(60));

  try {
    // 1. Check profiles table structure
    console.log('\n📊 1. Checking Profiles Table Structure...');
    console.log('─'.repeat(60));
    
    const { data: sampleProfile, error: sampleError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single();

    if (sampleError && sampleError.code !== 'PGRST116') {
      console.error('❌ Error accessing profiles table:', sampleError.message);
      console.error('   Code:', sampleError.code);
      console.error('   Details:', sampleError.details);
      console.error('   Hint:', sampleError.hint);
      return;
    }

    if (sampleProfile) {
      console.log('✅ Profiles table exists and is accessible');
      console.log('   Sample profile columns:', Object.keys(sampleProfile).join(', '));
    } else {
      console.log('⚠️  Profiles table exists but is empty');
    }

    // 2. Get all profiles
    console.log('\n👥 2. Fetching All User Profiles...');
    console.log('─'.repeat(60));
    
    const { data: allProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, role, status, created_at')
      .order('created_at', { ascending: false });

    if (profilesError) {
      console.error('❌ Error fetching profiles:', profilesError.message);
      return;
    }

    if (!allProfiles || allProfiles.length === 0) {
      console.log('⚠️  No profiles found in database');
      console.log('   You need to create user profiles in the profiles table');
      return;
    }

    console.log(`✅ Found ${allProfiles.length} user profile(s)\n`);

    // 3. Role Distribution
    console.log('📈 3. Role Distribution:');
    console.log('─'.repeat(60));
    
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
        roleUsers[role].push(profile);
      } else {
        if (!roleCounts['unknown']) {
          roleCounts['unknown'] = 0;
          roleUsers['unknown'] = [];
        }
        roleCounts['unknown']++;
        roleUsers['unknown'].push(profile);
      }
    });

    expectedRoles.forEach(role => {
      const count = roleCounts[role] || 0;
      const icon = ['head_admin', 'admin', 'editor', 'moderator'].includes(role) ? '🔐' : '👤';
      console.log(`${icon} ${role.padEnd(15)}: ${count} user(s)`);
    });

    if (roleCounts['unknown']) {
      console.log(`⚠️  unknown${' '.repeat(11)}: ${roleCounts['unknown']} user(s) (invalid role)`);
    }

    // 4. Admin Users List
    console.log('\n🔐 4. Admin Users:');
    console.log('─'.repeat(60));
    
    const adminRoles = ['head_admin', 'admin', 'editor', 'moderator'];
    const adminUsers = allProfiles.filter(p => adminRoles.includes(p.role || ''));
    
    if (adminUsers.length === 0) {
      console.log('⚠️  NO ADMIN USERS FOUND!');
      console.log('   You need at least one user with role: head_admin, admin, editor, or moderator');
    } else {
      adminUsers.forEach(user => {
        const roleIcon = user.role === 'head_admin' ? '👑' : 
                        user.role === 'admin' ? '🛡️' : 
                        user.role === 'editor' ? '✏️' : '🔍';
        console.log(`${roleIcon} ${user.email?.padEnd(40)} (${user.role}) - Status: ${user.status || 'active'}`);
      });
    }

    // 5. Users Without Roles
    console.log('\n⚠️  5. Users Without Valid Roles:');
    console.log('─'.repeat(60));
    
    const usersWithoutRoles = allProfiles.filter(p => 
      !p.role || 
      !expectedRoles.includes(p.role) ||
      p.role === 'user' && adminRoles.includes(p.role)
    );

    if (usersWithoutRoles.length > 0) {
      usersWithoutRoles.forEach(user => {
        console.log(`   • ${user.email} - Role: "${user.role || 'NULL'}"`);
      });
    } else {
      console.log('✅ All users have valid roles');
    }

    // 6. Head Admin Check
    console.log('\n👑 6. Head Administrators:');
    console.log('─'.repeat(60));
    
    const headAdmins = allProfiles.filter(p => p.role === 'head_admin');
    
    if (headAdmins.length === 0) {
      console.log('❌ NO HEAD ADMIN FOUND!');
      console.log('   You need at least one user with role: head_admin');
      console.log('   To fix: Update a user profile in Supabase dashboard:');
      console.log('   UPDATE profiles SET role = \'head_admin\' WHERE email = \'your-email@example.com\';');
    } else {
      headAdmins.forEach(admin => {
        console.log(`✅ ${admin.email} - Status: ${admin.status || 'active'}`);
      });
    }

    // 7. Status Check
    console.log('\n📊 7. User Status Distribution:');
    console.log('─'.repeat(60));
    
    const statusCounts: { [key: string]: number } = {};
    allProfiles.forEach(profile => {
      const status = profile.status || 'active';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    Object.entries(statusCounts).forEach(([status, count]) => {
      const icon = status === 'active' ? '✅' : status === 'disabled' ? '⏸️' : '🚫';
      console.log(`${icon} ${status.padEnd(15)}: ${count} user(s)`);
    });

    // 8. Summary
    console.log('\n📋 8. Summary:');
    console.log('─'.repeat(60));
    console.log(`   Total Users: ${allProfiles.length}`);
    console.log(`   Admin Users: ${adminUsers.length}`);
    console.log(`   Head Admins: ${headAdmins.length}`);
    console.log(`   Regular Users: ${roleCounts['user'] || 0}`);
    console.log(`   Users Without Roles: ${usersWithoutRoles.length}`);

    // 9. Recommendations
    console.log('\n💡 9. Recommendations:');
    console.log('─'.repeat(60));
    
    const issues: string[] = [];
    
    if (headAdmins.length === 0) {
      issues.push('Create at least one head_admin user');
    }
    
    if (adminUsers.length === 0) {
      issues.push('Create at least one admin user (head_admin, admin, editor, or moderator)');
    }
    
    const invalidRoles = allProfiles.filter(p => p.role && !expectedRoles.includes(p.role));
    if (invalidRoles.length > 0) {
      issues.push(`Fix ${invalidRoles.length} user(s) with invalid roles`);
    }
    
    const noRole = allProfiles.filter(p => !p.role);
    if (noRole.length > 0) {
      issues.push(`Assign roles to ${noRole.length} user(s) without roles`);
    }

    if (issues.length === 0) {
      console.log('✅ Database setup looks good!');
    } else {
      console.log('⚠️  Issues found:');
      issues.forEach((issue, index) => {
        console.log(`   ${index + 1}. ${issue}`);
      });
    }

    // 10. SQL Fixes
    if (headAdmins.length === 0 || issues.length > 0) {
      console.log('\n🔧 10. SQL Commands to Fix Issues:');
      console.log('─'.repeat(60));
      
      if (headAdmins.length === 0) {
        console.log('\n-- Set a user as head_admin (replace email):');
        console.log("UPDATE profiles SET role = 'head_admin' WHERE email = 'your-email@example.com';");
      }
      
      if (noRole.length > 0) {
        console.log('\n-- Set default role for users without roles:');
        console.log("UPDATE profiles SET role = 'user' WHERE role IS NULL;");
      }
      
      if (invalidRoles.length > 0) {
        console.log('\n-- Fix invalid roles (replace with valid role):');
        console.log("UPDATE profiles SET role = 'user' WHERE role NOT IN ('user', 'editor', 'moderator', 'admin', 'head_admin');");
      }
    }

    console.log('\n' + '═'.repeat(60));
    console.log('✅ Verification Complete!\n');

  } catch (error: any) {
    console.error('\n❌ Error during verification:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

verifySupabase().catch(console.error);
