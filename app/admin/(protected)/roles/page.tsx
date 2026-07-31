'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Shield, User, Edit, ShieldCheck, Crown, Search, Check, X, Trash2, Ban, UserX, UserCheck, AlertTriangle, MoreVertical, ArrowUp, ArrowDown, Settings } from 'lucide-react';
import { useToast } from '@/components/ToastProvider';
import PageContainer from '@/components/admin/PageContainer';
import PageHeader from '@/components/admin/PageHeader';
import StatCard from '@/components/admin/StatCard';
import SectionCard from '@/components/admin/SectionCard';
import FilterBar from '@/components/admin/FilterBar';
import AccessControl from '@/components/admin/AccessControl';
import { createPortal } from 'react-dom';

interface UserProfile {
  id: string;
  email: string;
  role: 'customer' | 'editor' | 'moderator' | 'admin' | 'head_admin';
  created_at: string;
  status?: 'active' | 'disabled' | 'banned';
  warnings?: number;
}

const roleConfig = {
  customer: { label: 'Customer', icon: User, color: 'bg-gray-100 text-gray-700', description: 'Regular customer' },
  editor: { label: 'Editor', icon: Edit, color: 'bg-gray-100 text-gray-700', description: 'Can edit content' },
  moderator: { label: 'Moderator', icon: ShieldCheck, color: 'bg-gray-100 text-gray-700', description: 'Can moderate content' },
  admin: { label: 'Admin', icon: Shield, color: 'bg-[#171717] text-white', description: 'Full admin access' },
  head_admin: { label: 'Head Admin', icon: Crown, color: 'bg-black text-white', description: 'Highest level access' },
};

// Dropdown Menu Component
function DropdownMenu({ 
  userId, 
  user, 
  isOpen, 
  onClose, 
  onPromote, 
  onDemote, 
  onEnable, 
  onDisable, 
  onBan, 
  onUnban, 
  onWarn,
  onDelete, 
  disabled 
}: {
  userId: string;
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onPromote: () => void;
  onDemote: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onBan: () => void;
  onUnban: () => void;
  onWarn: () => void;
  onDelete: () => void;
  disabled: boolean;
}) {
  const [position, setPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    if (isOpen) {
      const updatePosition = () => {
        // Find the button that triggered this dropdown
        const button = document.querySelector(`[data-user-id="${userId}"]`) as HTMLElement;
        if (button) {
          const rect = button.getBoundingClientRect();
          setPosition({
            top: rect.bottom + 8,
            right: window.innerWidth - rect.right,
          });
        }
      };
      // Small delay to ensure button is rendered
      setTimeout(updatePosition, 0);
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isOpen, userId]);

  // This component only renders the dropdown content, not the button
  if (!isOpen) {
    return null;
  }

  const dropdownContent = (
    <div 
      className="fixed bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden dropdown-container"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
        width: '240px'
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="py-2">
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-900">Role Management</p>
        </div>
        {user.role !== 'customer' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDemote();
            }}
            disabled={disabled}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-neutral-50 flex items-center gap-3 disabled:opacity-50 transition-colors"
          >
            <div className="p-1.5 bg-black/[0.04] rounded">
              <ArrowDown className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="font-medium">Demote</p>
              <p className="text-xs text-gray-500">Move to lower role</p>
            </div>
          </button>
        )}
        {user.role !== 'admin' && user.role !== 'head_admin' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPromote();
            }}
            disabled={disabled}
            className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-neutral-50 flex items-center gap-3 disabled:opacity-50 transition-colors"
          >
            <div className="p-1.5 bg-black/[0.04] rounded">
              <ArrowUp className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="font-medium">Promote</p>
              <p className="text-xs text-gray-500">Move to higher role</p>
            </div>
          </button>
        )}
        <div className="border-t border-gray-200 my-1"></div>
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-900">Account Status</p>
        </div>
        {user.status === 'disabled' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnable();
            }}
            disabled={disabled}
            className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
          >
            <div className="p-1.5 bg-black/[0.04] rounded">
              <UserCheck className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="font-medium">Enable Account</p>
              <p className="text-xs text-gray-500">Restore access</p>
            </div>
          </button>
        )}
        {user.status !== 'disabled' && user.status !== 'banned' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDisable();
            }}
            disabled={disabled}
            className="w-full text-left px-4 py-2.5 text-sm text-yellow-700 hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
          >
            <div className="p-1.5 bg-black/[0.04] rounded">
              <UserX className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="font-medium">Disable Account</p>
              <p className="text-xs text-gray-500">Temporarily restrict access</p>
            </div>
          </button>
        )}
        {user.status !== 'banned' && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onWarn();
              }}
              disabled={disabled}
              className="w-full text-left px-4 py-2.5 text-sm text-orange-700 hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
            >
              <div className="p-1.5 bg-black/[0.04] rounded">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
              </div>
              <div>
                <p className="font-medium">Warn User</p>
                <p className="text-xs text-gray-500">Issue a warning</p>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onBan();
              }}
              disabled={disabled}
              className="w-full text-left px-4 py-2.5 text-sm text-black/55 hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
            >
              <div className="p-1.5 bg-black/[0.04] rounded">
                <Ban className="w-4 h-4 text-black/55" />
              </div>
              <div>
                <p className="font-medium">Ban User</p>
                <p className="text-xs text-gray-500">Permanently restrict access</p>
              </div>
            </button>
          </>
        )}
        {user.status === 'banned' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onUnban();
            }}
            disabled={disabled}
            className="w-full text-left px-4 py-2.5 text-sm text-black hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
          >
            <div className="p-1.5 bg-black/[0.04] rounded">
              <UserCheck className="w-4 h-4 text-black" />
            </div>
            <div>
              <p className="font-medium">Unban User</p>
              <p className="text-xs text-gray-500">Restore access</p>
            </div>
          </button>
        )}
        <div className="border-t border-gray-200 my-1"></div>
        <div className="px-3 py-2 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-900">Danger Zone</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={disabled}
          className="w-full text-left px-4 py-2.5 text-sm text-black/55 hover:bg-black/[0.04] flex items-center gap-3 disabled:opacity-50 transition-colors"
        >
          <div className="p-1.5 bg-black/[0.04] rounded">
            <Trash2 className="w-4 h-4 text-black/55" />
          </div>
          <div>
            <p className="font-medium">Delete User</p>
            <p className="text-xs text-gray-500">Permanently remove account</p>
          </div>
        </button>
      </div>
    </div>
  );

  return typeof window !== 'undefined' ? createPortal(dropdownContent, document.body) : null;
}

export default function RoleManagementPage() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigningRole, setAssigningRole] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<Record<string, string>>({});
  const [userRole, setUserRole] = useState<string | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [managingUser, setManagingUser] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBanConfirm, setShowBanConfirm] = useState<string | null>(null);
  const [showWarnConfirm, setShowWarnConfirm] = useState<string | null>(null);
  const [showDisableConfirm, setShowDisableConfirm] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const supabase = useMemo(() => createClient(), []);
  const { showToast } = useToast();

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use API route that uses admin client to fetch all users (bypasses RLS)
      const response = await fetch('/api/admin/users');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch users' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const allUsers = (data.users || []) as UserProfile[];
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    
    const checkAccess = async () => {
      try {
        // Use robust API endpoint that bypasses RLS if needed
        // Skip client-side supabase.auth.getUser() to avoid potential hangs
        const roleResponse = await fetch('/api/admin/current-role');
        
        if (!mounted) return;
        
        if (roleResponse.ok) {
          const roleData = await roleResponse.json();
          
          if (!mounted) return;
          
          if (roleData.authenticated && roleData.role === 'head_admin') {
            setUserRole('head_admin');
            // Allow access immediately
            setCheckingAccess(false);
            
            // Load users in background
            loadUsers().catch(err => console.error('Background user load failed:', err));
          } else {
            setUserRole(roleData.role || null);
            setCheckingAccess(false);
            showToast('Access denied. Only Head Administrators can manage roles.', 'error');
          }
        } else {
          // API failed
          setUserRole(null);
          setCheckingAccess(false);
        }
      } catch (error) {
        console.error('Error checking access:', error);
        if (mounted) {
          setUserRole(null);
          setCheckingAccess(false);
        }
      }
    };

    checkAccess();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Use useMemo for filtered users to prevent unnecessary re-renders
  const { filteredUsers, filteredAdminUsers } = useMemo(() => {
    const regularUsers = users.filter(u => u.role === 'customer');
    const adminUsers = users.filter(u => u.role !== 'customer');
    
    if (searchQuery.trim() === '') {
      return {
        filteredUsers: regularUsers,
        filteredAdminUsers: adminUsers,
      };
    } else {
      const query = searchQuery.toLowerCase();
      return {
        filteredUsers: regularUsers.filter(
          (user) =>
            user.email.toLowerCase().includes(query) ||
            roleConfig[user.role].label.toLowerCase().includes(query)
        ),
        filteredAdminUsers: adminUsers.filter(
          (user) =>
            user.email.toLowerCase().includes(query) ||
            roleConfig[user.role].label.toLowerCase().includes(query)
        ),
      };
    }
  }, [searchQuery, users]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const user = users.find(u => u.id === userId);
      
      // Prevent changing head_admin role
      if (user && user.role === 'head_admin') {
        showToast('Head Admin role cannot be changed', 'error');
        return;
      }
      
      setAssigningRole(userId);
      
      const response = await fetch('/api/admin/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to assign role');
      }

      showToast(`Role updated to ${roleConfig[newRole as keyof typeof roleConfig].label}`, 'success');
      
      // Update local state
      setUsers((prev) =>
        prev.map((user) =>
          user.id === userId ? { ...user, role: newRole as UserProfile['role'] } : user
        )
      );
      
      setSelectedRole((prev) => {
        const updated = { ...prev };
        delete updated[userId];
        return updated;
      });
    } catch (error: any) {
      showToast(error.message || 'Failed to assign role', 'error');
    } finally {
      setAssigningRole(null);
    }
  };

  const handleUserAction = async (userId: string, action: 'delete' | 'disable' | 'ban' | 'enable' | 'warn') => {
    try {
      setManagingUser(userId);
      
      const response = await fetch('/api/admin/manage-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} user`);
      }

      showToast(data.message || `User ${action}d successfully`, 'success');
      
      // Update local state immediately instead of reloading
      if (action === 'enable') {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, status: 'active' as const } : user
          )
        );
      } else if (action === 'disable') {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, status: 'disabled' as const } : user
          )
        );
      } else if (action === 'ban') {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, status: 'banned' as const } : user
          )
        );
      } else if (action === 'warn') {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === userId ? { ...user, warnings: (user.warnings || 0) + 1 } : user
          )
        );
      } else if (action === 'delete') {
        // Remove user from state for delete
        setUsers((prev) => prev.filter((user) => user.id !== userId));
      }
      
      // Close confirmation dialogs and dropdown
      setShowDeleteConfirm(null);
      setShowBanConfirm(null);
      setShowWarnConfirm(null);
      setShowDisableConfirm(null);
      setOpenDropdown(null);
    } catch (error: any) {
      showToast(error.message || `Failed to ${action} user`, 'error');
    } finally {
      setManagingUser(null);
    }
  };

  const handlePromote = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    let newRole: string;
    if (user.role === 'customer') {
      newRole = 'editor';
    } else if (user.role === 'editor') {
      newRole = 'moderator';
    } else if (user.role === 'moderator') {
      newRole = 'admin';
    } else {
      showToast('User is already at the highest promotable level', 'info');
      return;
    }

    await handleRoleChange(userId, newRole);
    setOpenDropdown(null);
  };

  const handleDemote = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;

    let newRole: string;
    if (user.role === 'admin') {
      newRole = 'moderator';
    } else if (user.role === 'moderator') {
      newRole = 'editor';
    } else if (user.role === 'editor') {
      newRole = 'customer';
    } else if (user.role === 'customer') {
      showToast('User is already at the lowest level', 'info');
      return;
    } else {
      showToast('Cannot demote this user', 'error');
      return;
    }

    await handleRoleChange(userId, newRole);
    setOpenDropdown(null);
  };

  const getStatusBadge = (status?: string, warnings?: number) => {
    const badges = [];
    
    if (!status || status === 'active') {
      badges.push(
        <span key="status" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-black/[0.06] text-black">
          <UserCheck className="w-3 h-3" />
          Active
        </span>
      );
    } else if (status === 'disabled') {
      badges.push(
        <span key="status" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-black/[0.04] text-black/55">
          <UserX className="w-3 h-3" />
          Disabled
        </span>
      );
    } else if (status === 'banned') {
      badges.push(
        <span key="status" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-black/[0.06] text-black/55">
          <Ban className="w-3 h-3" />
          Banned
        </span>
      );
    }
    
    if (warnings && warnings > 0) {
      badges.push(
        <span key="warnings" className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-black/[0.04] text-black/55">
          <AlertTriangle className="w-3 h-3" />
          {warnings} Warning{warnings !== 1 ? 's' : ''}
        </span>
      );
    }
    
    return badges.length > 0 ? <div className="flex items-center gap-2 flex-wrap">{badges}</div> : null;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openDropdown && !(event.target as Element).closest('.dropdown-container')) {
        setOpenDropdown(null);
      }
    };

    if (openDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [openDropdown]);

  const getRoleStats = () => {
    const stats = {
      customer: users.filter((u) => u.role === 'customer').length,
      editor: users.filter((u) => u.role === 'editor').length,
      moderator: users.filter((u) => u.role === 'moderator').length,
      admin: users.filter((u) => u.role === 'admin').length,
      head_admin: users.filter((u) => u.role === 'head_admin').length,
    };
    return stats;
  };

  const stats = getRoleStats();

  if (checkingAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-4 border-[#171717] border-t-transparent"></div>
          <p className="mt-6 text-lg text-gray-700 font-semibold">Checking access...</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'head_admin') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Only Head Administrators can access role management.</p>
        </div>
      </div>
    );
  }

  return (
    <AccessControl allowedRoles={['head_admin']}>
      <PageContainer>
        <PageHeader
          title="Role Management"
          description="Assign and manage user roles. You can assign roles up to Admin level only."
          badge={
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
              <Crown className="w-3.5 h-3.5" />
              Head Administrator
            </span>
          }
        />

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 lg:gap-6 mb-6 lg:mb-8">
        {Object.entries(roleConfig).map(([role, config]) => {
          const Icon = config.icon;
          const count = stats[role as keyof typeof stats];
          return (
            <StatCard
              key={role}
              label={config.label}
              value={count}
              icon={Icon}
            />
          );
        })}
      </div>

      {/* Search and Filters */}
      <FilterBar
        searchPlaceholder="Search by email or role..."
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        className="mb-6 lg:mb-8"
      />

      {/* Regular Users Table */}
      <SectionCard className="mb-6 lg:mb-8">
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4" />
            Regular Users ({filteredUsers.length})
          </h3>
          <p className="text-xs text-gray-500 mt-1">All registered customers and regular users</p>
        </div>
        <div className="overflow-x-auto relative">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Joined Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Loading users...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No regular users found
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const currentRoleConfig = roleConfig[user.role];
                  const CurrentIcon = currentRoleConfig.icon;

                  return (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                          <p className="text-sm font-medium text-gray-900">{user.email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          <CurrentIcon className="w-3 h-3" />
                          {currentRoleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(user.status, user.warnings)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-gray-600">
                          {new Date(user.created_at).toLocaleDateString('en-US', { 
                            year: 'numeric', 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        {user.role !== 'head_admin' && (
                          <div className="dropdown-container">
                            <button
                              data-user-id={user.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenDropdown(openDropdown === user.id ? null : user.id);
                              }}
                              disabled={managingUser === user.id}
                              className="inline-flex items-center justify-center w-7 h-7 text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title="Actions"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                            <DropdownMenu
                              userId={user.id}
                              user={user}
                              isOpen={openDropdown === user.id}
                              onClose={() => setOpenDropdown(null)}
                              onPromote={() => handlePromote(user.id)}
                              onDemote={() => handleDemote(user.id)}
                              onEnable={() => handleUserAction(user.id, 'enable')}
                              onDisable={() => {
                                setShowDisableConfirm(user.id);
                                setOpenDropdown(null);
                              }}
                              onBan={() => {
                                setShowBanConfirm(user.id);
                                setOpenDropdown(null);
                              }}
                              onUnban={() => handleUserAction(user.id, 'enable')}
                              onWarn={() => {
                                setShowWarnConfirm(user.id);
                                setOpenDropdown(null);
                              }}
                              onDelete={() => {
                                setShowDeleteConfirm(user.id);
                                setOpenDropdown(null);
                              }}
                              disabled={managingUser === user.id}
                            />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Admin Team Table */}
      <SectionCard className="mb-6 lg:mb-8">
        <div className="mb-4 pb-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Admin Team ({filteredAdminUsers.length})
          </h3>
          <p className="text-xs text-gray-500 mt-1">Manage administrative roles and permissions</p>
        </div>
        <div className="overflow-x-auto relative">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Current Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Assign Role</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    Loading admin team...
                  </td>
                </tr>
              ) : filteredAdminUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    No admin team members found
                  </td>
                </tr>
              ) : (
                filteredAdminUsers.map((user) => {
                  const currentRoleConfig = roleConfig[user.role];
                  const CurrentIcon = currentRoleConfig.icon;
                  const isAssigning = assigningRole === user.id;
                  const selectedNewRole = selectedRole[user.id] || user.role;

                  return (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-neutral-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                            <CurrentIcon className="w-4 h-4 text-gray-600" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{user.email}</p>
                            <p className="text-xs text-gray-500">
                              Joined {new Date(user.created_at).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              })}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          <CurrentIcon className="w-3 h-3" />
                          {currentRoleConfig.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {getStatusBadge(user.status, user.warnings)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <select
                            value={selectedNewRole}
                            onChange={(e) => setSelectedRole({ ...selectedRole, [user.id]: e.target.value })}
                            disabled={isAssigning || user.role === 'head_admin'}
                            className="text-sm border border-gray-300 rounded px-3 py-1.5 focus:ring-2 focus:ring-[#171717] focus:border-[#171717] outline-none disabled:opacity-50 disabled:cursor-not-allowed bg-white"
                          >
                            {/* Allow demoting admin roles to user */}
                            {user.role === 'head_admin' ? (
                              <>
                                <option value="head_admin">Head Admin</option>
                              </>
                            ) : user.role === 'admin' ? (
                              <>
                                <option value="customer">Customer</option>
                                <option value="editor">Editor</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </>
                            ) : user.role === 'moderator' ? (
                              <>
                                <option value="customer">Customer</option>
                                <option value="editor">Editor</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </>
                            ) : user.role === 'editor' ? (
                              <>
                                <option value="customer">Customer</option>
                                <option value="editor">Editor</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </>
                            ) : (
                              <>
                                <option value="customer">Customer</option>
                                <option value="editor">Editor</option>
                                <option value="moderator">Moderator</option>
                                <option value="admin">Admin</option>
                              </>
                            )}
                          </select>
                          {selectedNewRole !== user.role && user.role !== 'head_admin' && (
                            <button
                              onClick={() => handleRoleChange(user.id, selectedNewRole)}
                              disabled={isAssigning}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] text-white text-xs font-medium rounded hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isAssigning ? (
                                <>
                                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span>Updating...</span>
                                </>
                              ) : (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Apply</span>
                                </>
                              )}
                            </button>
                          )}
                          {user.role === 'head_admin' && (
                            <span className="text-xs text-gray-400 italic">Protected</span>
                          )}
                          {selectedNewRole === user.role && user.role !== 'head_admin' && (
                            <span className="text-xs text-gray-400">No changes</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user.role !== 'head_admin' && (
                          <DropdownMenu
                            userId={user.id}
                            user={user}
                            isOpen={openDropdown === user.id}
                            onClose={() => setOpenDropdown(null)}
                            onPromote={() => handlePromote(user.id)}
                            onDemote={() => handleDemote(user.id)}
                            onEnable={() => handleUserAction(user.id, 'enable')}
                            onDisable={() => handleUserAction(user.id, 'disable')}
                            onBan={() => {
                              setShowBanConfirm(user.id);
                              setOpenDropdown(null);
                            }}
                            onUnban={() => handleUserAction(user.id, 'enable')}
                            onWarn={() => {
                              setShowWarnConfirm(user.id);
                              setOpenDropdown(null);
                            }}
                            onDelete={() => {
                              setShowDeleteConfirm(user.id);
                              setOpenDropdown(null);
                            }}
                            disabled={managingUser === user.id || isAssigning}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* Click outside to close dropdown */}
      {openDropdown && (
        <div
          className="fixed inset-0"
          onClick={() => setOpenDropdown(null)}
          style={{ zIndex: 40 }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-neutral-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black/[0.06] rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-black/55" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Delete User</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed mb-1">
                Are you sure you want to delete this user?
              </p>
              <p className="text-xs text-gray-500 mb-6">
                This action cannot be undone and will permanently remove the user account and all associated data.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-neutral-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction(showDeleteConfirm, 'delete')}
                  disabled={managingUser === showDeleteConfirm}
                  className="px-4 py-2 text-xs font-medium text-white bg-black rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {managingUser === showDeleteConfirm ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Deleting...
                    </span>
                  ) : (
                    'Delete User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ban Confirmation Modal */}
      {showBanConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-neutral-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black/[0.04] rounded-lg">
                  <Ban className="w-5 h-5 text-orange-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Ban User</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed mb-1">
                Are you sure you want to ban this user?
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Banned users will not be able to access the platform. You can unban them later if needed.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowBanConfirm(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-neutral-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction(showBanConfirm, 'ban')}
                  disabled={managingUser === showBanConfirm}
                  className="px-4 py-2 text-xs font-medium text-white bg-black rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {managingUser === showBanConfirm ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Banning...
                    </span>
                  ) : (
                    'Ban User'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warn Confirmation Modal */}
      {showWarnConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-neutral-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black/[0.04] rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Warn User</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed mb-1">
                Are you sure you want to issue a warning to this user?
              </p>
              <p className="text-xs text-gray-500 mb-6">
                This warning will be recorded on their account and visible to them. Multiple warnings may result in account restrictions.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowWarnConfirm(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-neutral-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction(showWarnConfirm, 'warn')}
                  disabled={managingUser === showWarnConfirm}
                  className="px-4 py-2 text-xs font-medium text-white bg-[#171717] rounded hover:bg-[#262626] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {managingUser === showWarnConfirm ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Warning...
                    </span>
                  ) : (
                    'Issue Warning'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Disable Confirmation Modal */}
      {showDisableConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-neutral-50 to-transparent">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-black/[0.04] rounded-lg">
                  <UserX className="w-5 h-5 text-yellow-600" />
                </div>
                <h3 className="text-base font-semibold text-gray-900">Disable User</h3>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 leading-relaxed mb-1">
                Are you sure you want to disable this user's account?
              </p>
              <p className="text-xs text-gray-500 mb-6">
                Disabled users will not be able to access the platform. You can enable their account again at any time.
              </p>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setShowDisableConfirm(null)}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-neutral-50 border border-gray-200 rounded hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleUserAction(showDisableConfirm, 'disable')}
                  disabled={managingUser === showDisableConfirm}
                  className="px-4 py-2 text-xs font-medium text-white bg-black rounded hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {managingUser === showDisableConfirm ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Disabling...
                    </span>
                  ) : (
                    'Disable Account'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <SectionCard>
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Role Permissions & Assignment Rules</h3>
            <div className="space-y-1.5 mb-4 text-xs text-gray-600">
              <div><span className="font-medium text-gray-900">User:</span> Regular customer access</div>
              <div><span className="font-medium text-gray-900">Editor:</span> Can edit content and products</div>
              <div><span className="font-medium text-gray-900">Moderator:</span> Can moderate reviews and questions</div>
              <div><span className="font-medium text-gray-900">Admin:</span> Full access to all admin features</div>
              <div className="pt-1.5 border-t border-gray-200"><span className="font-medium text-gray-900">Head Admin:</span> Can assign roles (up to Admin level) and full admin access</div>
            </div>
            <div className="bg-neutral-50 border border-gray-200 rounded p-3">
              <p className="text-xs text-gray-600">
                <strong className="font-medium text-gray-900">Important:</strong> As a Head Administrator, you can only assign roles up to Admin level. 
                Head Admin roles cannot be assigned through this interface.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    </PageContainer>
    </AccessControl>
  );
}


