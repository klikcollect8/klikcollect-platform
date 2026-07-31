"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import { createClient } from "@/lib/supabase/client";
import {
  User,
  LogOut,
  Mail,
  Shield,
  Calendar,
  Package,
  ShoppingBag,
  MessageSquare,
  HelpCircle,
  Edit,
  Activity,
  Settings,
  Lock,
  Bell,
  Download,
  Trash2,
  Key,
  Monitor,
  Smartphone,
  Globe,
  Eye,
  EyeOff,
  Filter,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  Save,
  RefreshCw,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import PageContainer from "@/components/admin/PageContainer";
import PageHeader from "@/components/admin/PageHeader";
import SectionCard from "@/components/admin/SectionCard";
import StatCard from "@/components/admin/StatCard";
import { useToast } from "@/components/ToastProvider";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ActivityItem {
  id: string;
  type:
    | "product"
    | "order"
    | "review"
    | "question"
    | "login"
    | "logout"
    | "settings"
    | "category"
    | "homepage";
  action: string;
  description: string;
  timestamp: string;
  link?: string;
  ip?: string;
  device?: string;
  metadata?: any;
}

interface Session {
  id: string;
  device: string;
  location: string;
  lastActive: string;
  current: boolean;
  ip?: string;
  userAgent?: string;
}

interface Preferences {
  notifications: {
    email: boolean;
    orderUpdates: boolean;
    productAlerts: boolean;
    securityAlerts: boolean;
  };
  language: string;
  timezone: string;
  theme: string;
}

type TabType =
  | "overview"
  | "account"
  | "security"
  | "activity"
  | "preferences"
  | "advanced";

export default function AdminProfilePage() {
  const router = useRouter();
  const supabase = createClient();
  const toast = useToast();
  const { signOut } = useClerk();
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({
    notifications: {
      email: true,
      orderUpdates: true,
      productAlerts: true,
      securityAlerts: true,
    },
    language: "en",
    timezone: "UTC",
    theme: "light",
  });
  const [stats, setStats] = useState({
    productsCreated: 0,
    productsEdited: 0,
    ordersManaged: 0,
    reviewsModerated: 0,
    questionsAnswered: 0,
    totalLogins: 0,
  });

  // Form states
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  // Activity filter states
  const [activityFilter, setActivityFilter] = useState<string>("all");
  const [activityTypeFilter, setActivityTypeFilter] = useState<string>("all");
  const [showActivityFilters, setShowActivityFilters] = useState(false);
  const [activityPage, setActivityPage] = useState(1);
  const [activityLoading, setActivityLoading] = useState(false);

  // Delete account confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load profile data — Clerk identity (same as Commerce OS)
  const loadProfile = useCallback(async () => {
    try {
      if (!clerkLoaded) return;

      if (!clerkUser) {
        router.push("/admin/login");
        return;
      }

      const emailAddress =
        clerkUser.primaryEmailAddress?.emailAddress ||
        clerkUser.emailAddresses[0]?.emailAddress ||
        "";

      const roleRes = await fetch("/api/admin/current-role");
      const roleData = await roleRes.json();

      setUser({
        id: clerkUser.id,
        email: emailAddress,
        user_metadata: {
          full_name:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            clerkUser.username ||
            emailAddress,
        },
        created_at: clerkUser.createdAt
          ? new Date(clerkUser.createdAt).toISOString()
          : undefined,
      });
      setEmail(emailAddress);

      // Prefer Supabase profile by email when present; otherwise Clerk-backed stub
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", emailAddress)
        .maybeSingle();

      setProfile(
        profileData || {
          id: clerkUser.id,
          email: emailAddress,
          role: roleData.role || "head_admin",
          full_name:
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
            null,
        },
      );

      // Load preferences
      const { data: prefsData } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", clerkUser.id)
        .maybeSingle();

      if (prefsData) {
        setPreferences({
          notifications: prefsData.notifications || preferences.notifications,
          language: prefsData.language || "en",
          timezone: prefsData.timezone || "UTC",
          theme: prefsData.theme || "light",
        });
      }

      // Log login activity (only once per session)
      const sessionKey = `login_logged_${clerkUser.id}_${new Date().toDateString()}`;
      if (!sessionStorage.getItem(sessionKey)) {
        await logActivity(
          "login",
          "login",
          "Logged into admin panel",
          "/admin",
        );
        sessionStorage.setItem(sessionKey, "true");
      }

      const role = profileData?.role || roleData.role || "user";

      // Load all data in parallel
      await Promise.all([
        loadActivity(role, clerkUser.id),
        loadSessions(clerkUser.id),
        loadStats(role, clerkUser.id),
      ]);

      setLoading(false);
    } catch (error) {
      console.error("Error loading profile:", error);
      toast.showToast("Failed to load profile", "error");
      setLoading(false);
    }
  }, [supabase, router, toast, clerkUser, clerkLoaded]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadStats = async (role: string, userId: string) => {
    const newStats = {
      productsCreated: 0,
      productsEdited: 0,
      ordersManaged: 0,
      reviewsModerated: 0,
      questionsAnswered: 0,
      totalLogins: 0,
    };

    try {
      // Count login activities
      const { data: loginActivities } = await supabase
        .from("activity_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("type", "login");

      newStats.totalLogins = loginActivities?.length || 0;

      // Count products created/edited
      if (["editor", "admin", "head_admin"].includes(role)) {
        const { data: products } = await supabase
          .from("products")
          .select("created_by, updated_by")
          .or(`created_by.eq.${userId},updated_by.eq.${userId}`);

        products?.forEach((product: any) => {
          if (product.created_by === userId) newStats.productsCreated++;
          if (product.updated_by === userId) newStats.productsEdited++;
        });
      }

      // Count orders managed
      if (["admin", "head_admin"].includes(role)) {
        const { data: orders } = await supabase
          .from("orders")
          .select("updated_by")
          .eq("updated_by", userId);

        newStats.ordersManaged = orders?.length || 0;
      }

      // Count reviews moderated
      if (["moderator", "admin", "head_admin"].includes(role)) {
        const { data: reviews } = await supabase
          .from("reviews")
          .select("updated_by, status")
          .eq("updated_by", userId)
          .neq("status", "pending");

        newStats.reviewsModerated = reviews?.length || 0;
      }

      // Count questions answered
      if (["moderator", "admin", "head_admin"].includes(role)) {
        const { data: questions } = await supabase
          .from("questions")
          .select("updated_by, status")
          .eq("updated_by", userId)
          .neq("status", "pending");

        newStats.questionsAnswered = questions?.length || 0;
      }

      setStats(newStats);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const loadActivity = async (
    role: string,
    userId: string,
    page: number = 1,
  ) => {
    setActivityLoading(true);
    try {
      let query = supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range((page - 1) * 20, page * 20 - 1);

      // Apply type filter
      if (activityTypeFilter !== "all") {
        query = query.eq("type", activityTypeFilter);
      }

      // Apply time filter
      if (activityFilter === "today") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        query = query.gte("created_at", today.toISOString());
      } else if (activityFilter === "week") {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        query = query.gte("created_at", weekAgo.toISOString());
      } else if (activityFilter === "month") {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        query = query.gte("created_at", monthAgo.toISOString());
      }

      const { data, error } = await query;

      if (error) throw error;

      const activities: ActivityItem[] = (data || []).map((item: any) => ({
        id: item.id,
        type: item.type,
        action: item.action,
        description: item.description,
        timestamp: item.created_at,
        link: item.link,
        ip: item.ip_address,
        device: item.user_agent,
        metadata: item.metadata,
      }));

      if (page === 1) {
        setRecentActivity(activities);
      } else {
        setRecentActivity((prev) => [...prev, ...activities]);
      }
    } catch (error) {
      console.error("Error loading activity:", error);
      toast.showToast("Failed to load activity", "error");
    } finally {
      setActivityLoading(false);
    }
  };

  const logActivity = async (
    type: ActivityItem["type"],
    action: string,
    description: string,
    link?: string,
    metadata?: any,
  ) => {
    if (!user) return;

    try {
      await supabase.from("activity_logs").insert({
        user_id: user.id,
        type,
        action,
        description,
        link,
        metadata: metadata || {},
        ip_address: await getClientIP(),
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Error logging activity:", error);
    }
  };

  const getClientIP = async (): Promise<string> => {
    try {
      const response = await fetch("https://api.ipify.org?format=json");
      const data = await response.json();
      return data.ip || "Unknown";
    } catch {
      return "Unknown";
    }
  };

  const loadSessions = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_sessions")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("last_active_at", { ascending: false });

      if (error) throw error;

      const currentToken = null;

      const sessionsList: Session[] = (data || []).map((session: any) => ({
        id: session.id,
        device: session.device_info || "Unknown Device",
        location: session.location || "Unknown Location",
        lastActive: session.last_active_at,
        current: false,
        ip: session.ip_address,
        userAgent: session.user_agent,
      }));

      // If no sessions found, show device fallback
      if (sessionsList.length === 0) {
        setSessions([
          {
            id: "1",
            device: navigator.userAgent.includes("Windows")
              ? "Windows"
              : navigator.userAgent.includes("Mac")
                ? "macOS"
                : "Unknown",
            location: "Unknown",
            lastActive: new Date().toISOString(),
            current: true,
          },
        ]);
        return;
      }

      setSessions(sessionsList);
    } catch (error) {
      console.error("Error loading sessions:", error);
      // Fallback to mock sessions if table doesn't exist yet
      setSessions([
        {
          id: "1",
          device: navigator.userAgent.includes("Windows")
            ? "Windows"
            : navigator.userAgent.includes("Mac")
              ? "macOS"
              : "Unknown",
          location: "Unknown",
          lastActive: new Date().toISOString(),
          current: true,
        },
      ]);
    }
  };

  const createCurrentSession = async (userId: string, token: string) => {
    try {
      await supabase.from("user_sessions").insert({
        user_id: userId,
        session_token: token,
        device_info: getDeviceInfo(),
        user_agent: navigator.userAgent,
        ip_address: await getClientIP(),
        location: "Unknown", // Could use IP geolocation service
        is_active: true,
        last_active_at: new Date().toISOString(),
        expires_at: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000,
        ).toISOString(), // 7 days
      });
    } catch (error) {
      console.error("Error creating session:", error);
    }
  };

  const getDeviceInfo = (): string => {
    const ua = navigator.userAgent;
    if (ua.includes("Windows")) return "Windows";
    if (ua.includes("Mac")) return "macOS";
    if (ua.includes("Linux")) return "Linux";
    if (ua.includes("Android")) return "Android";
    if (ua.includes("iOS") || ua.includes("iPhone") || ua.includes("iPad"))
      return "iOS";
    return "Unknown";
  };

  const handleUpdateEmail = async () => {
    toast.showToast(
      "Manage email in your Clerk account settings (identity is Clerk-only).",
      "info",
    );
    window.open("https://accounts.clerk.com/user", "_blank");
  };

  const handleUpdatePassword = async () => {
    toast.showToast(
      "Manage password in your Clerk account settings (identity is Clerk-only).",
      "info",
    );
    window.open("https://accounts.clerk.com/user", "_blank");
  };

  const handleSavePreferences = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const { error } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          notifications: preferences.notifications,
          language: preferences.language,
          timezone: preferences.timezone,
          theme: preferences.theme,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: "user_id",
        },
      );

      if (error) throw error;

      await logActivity(
        "settings",
        "preferences_update",
        "Updated preferences",
      );
      toast.showToast("Preferences saved successfully", "success");
    } catch (error: any) {
      toast.showToast(error.message || "Failed to save preferences", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({ redirectUrl: "/admin/login" });
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = "/admin/login";
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("user_sessions")
        .update({ is_active: false })
        .eq("id", sessionId);

      if (error) throw error;

      await logActivity("settings", "session_revoked", "Revoked session");
      toast.showToast("Session revoked", "success");
      await loadSessions(user?.id || "");
    } catch (error: any) {
      toast.showToast(error.message || "Failed to revoke session", "error");
    }
  };

  const handleExportData = async () => {
    if (!user) return;

    try {
      const data = {
        profile: {
          id: user.id,
          email: user.email,
          role: profile?.role,
          createdAt: user.created_at,
        },
        preferences,
        stats,
        recentActivity: recentActivity.slice(0, 100),
        sessions: sessions.map((s) => ({
          device: s.device,
          location: s.location,
          lastActive: s.lastActive,
        })),
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `profile-data-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);

      await logActivity("settings", "data_export", "Exported account data");
      toast.showToast("Data exported successfully", "success");
    } catch (error) {
      toast.showToast("Failed to export data", "error");
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;

    try {
      // In production, implement proper account deletion
      // This would typically involve:
      // 1. Delete all user data
      // 2. Delete user sessions
      // 3. Delete activity logs
      // 4. Delete preferences
      // 5. Delete auth user

      await logActivity(
        "settings",
        "account_deletion",
        "Account deletion requested",
      );
      toast.showToast(
        "Account deletion is not available in demo mode",
        "error",
      );
      setShowDeleteConfirm(false);
    } catch (error) {
      toast.showToast("Failed to delete account", "error");
    }
  };

  const getRoleLabel = (role: string | null) => {
    const roleLabels: { [key: string]: string } = {
      head_admin: "Head Administrator",
      admin: "Administrator",
      editor: "Editor",
      moderator: "Moderator",
      user: "User",
    };
    return roleLabels[role || "user"] || "User";
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "product":
        return Package;
      case "order":
        return ShoppingBag;
      case "review":
        return MessageSquare;
      case "question":
        return HelpCircle;
      case "login":
        return LogOut;
      case "logout":
        return LogOut;
      case "settings":
        return Settings;
      case "category":
        return Package;
      case "homepage":
        return Settings;
      default:
        return Activity;
    }
  };

  // Filter activity based on filters
  useEffect(() => {
    if (user && activeTab === "activity") {
      loadActivity(profile?.role || "user", user.id, 1);
    }
  }, [activityFilter, activityTypeFilter, user, profile, activeTab]);

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: "overview", label: "Overview", icon: User },
    { id: "account", label: "Account", icon: Settings },
    { id: "security", label: "Security", icon: Lock },
    { id: "activity", label: "Activity", icon: Activity },
    { id: "preferences", label: "Preferences", icon: Bell },
    { id: "advanced", label: "Advanced", icon: Shield },
  ];

  if (loading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#171717]"></div>
            <p className="text-sm text-gray-600 mt-4">Loading profile...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="My Profile"
        description="Manage your account settings and preferences"
      />

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#171717] text-[#171717]"
                    : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Profile Card */}
          <SectionCard>
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {user?.user_metadata?.full_name ||
                    user?.email?.split("@")[0] ||
                    "User"}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{user?.email}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                    <Shield className="w-3 h-3" />
                    {getRoleLabel(profile?.role)}
                  </span>
                  <span className="text-xs text-gray-500">
                    Member since{" "}
                    {user?.created_at
                      ? format(new Date(user.created_at), "MMM d, yyyy")
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stats.productsCreated > 0 && (
              <StatCard
                label="Products Created"
                value={stats.productsCreated}
                icon={Package}
              />
            )}
            {stats.productsEdited > 0 && (
              <StatCard
                label="Products Edited"
                value={stats.productsEdited}
                icon={Edit}
              />
            )}
            {stats.ordersManaged > 0 && (
              <StatCard
                label="Orders Managed"
                value={stats.ordersManaged}
                icon={ShoppingBag}
              />
            )}
            {stats.reviewsModerated > 0 && (
              <StatCard
                label="Reviews Moderated"
                value={stats.reviewsModerated}
                icon={MessageSquare}
              />
            )}
            {stats.questionsAnswered > 0 && (
              <StatCard
                label="Questions Answered"
                value={stats.questionsAnswered}
                icon={HelpCircle}
              />
            )}
            <StatCard
              label="Total Logins"
              value={stats.totalLogins}
              icon={LogOut}
            />
          </div>

          {/* Recent Activity */}
          <SectionCard title="Recent Activity">
            {recentActivity.slice(0, 10).length > 0 ? (
              <div className="space-y-3">
                {recentActivity.slice(0, 10).map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDistanceToNow(new Date(activity.timestamp), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {activity.link && (
                        <a
                          href={activity.link}
                          className="text-xs font-medium text-[#171717] hover:underline flex-shrink-0"
                        >
                          View
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No recent activity</p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Account Tab */}
      {activeTab === "account" && (
        <div className="space-y-6">
          <SectionCard title="Email Address">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717]"
                  />
                  <button
                    onClick={handleUpdateEmail}
                    disabled={saving || email === user?.email}
                    className="px-3 py-2 bg-[#171717] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Update"}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  A confirmation email will be sent to your new address
                </p>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Change Password">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717] pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <button
                onClick={handleUpdatePassword}
                disabled={
                  saving ||
                  !currentPassword ||
                  !newPassword ||
                  newPassword !== confirmPassword
                }
                className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Updating..." : "Update Password"}
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Security Tab */}
      {activeTab === "security" && (
        <div className="space-y-6">
          <SectionCard title="Active Sessions">
            <div className="space-y-3">
              {sessions.length > 0 ? (
                sessions.map((session) => (
                  <div
                    key={session.id}
                    className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neutral-50 flex items-center justify-center">
                        {session.device.includes("Windows") ||
                        session.device.includes("macOS") ? (
                          <Monitor className="w-5 h-5 text-gray-400" />
                        ) : (
                          <Smartphone className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {session.device}
                        </p>
                        <p className="text-xs text-gray-500">
                          {session.location}
                        </p>
                        <p className="text-xs text-gray-500">
                          Last active:{" "}
                          {formatDistanceToNow(new Date(session.lastActive), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {session.current && (
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                          Current
                        </span>
                      )}
                      {!session.current && (
                        <button
                          onClick={() => handleRevokeSession(session.id)}
                          className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Monitor className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">No active sessions</p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Two-Factor Authentication">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    2FA Status
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                  Not Enabled
                </span>
              </div>
              <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors">
                Enable 2FA
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <div className="space-y-6">
          <SectionCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900">
                Activity Log
              </h3>
              <button
                onClick={() => setShowActivityFilters(!showActivityFilters)}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Filter className="w-4 h-4" />
                Filters
              </button>
            </div>

            {showActivityFilters && (
              <div className="mb-4 p-4 border border-gray-200 rounded-lg bg-neutral-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Time Period
                    </label>
                    <select
                      value={activityFilter}
                      onChange={(e) => setActivityFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717]"
                    >
                      <option value="all">All Time</option>
                      <option value="today">Today</option>
                      <option value="week">Last 7 Days</option>
                      <option value="month">Last 30 Days</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-2">
                      Activity Type
                    </label>
                    <select
                      value={activityTypeFilter}
                      onChange={(e) => setActivityTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717]"
                    >
                      <option value="all">All Types</option>
                      <option value="product">Products</option>
                      <option value="order">Orders</option>
                      <option value="review">Reviews</option>
                      <option value="question">Questions</option>
                      <option value="login">Logins</option>
                      <option value="settings">Settings</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {activityLoading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#171717]"></div>
                <p className="text-sm text-gray-600 mt-2">
                  Loading activity...
                </p>
              </div>
            ) : recentActivity.length > 0 ? (
              <div className="space-y-2">
                {recentActivity.map((activity) => {
                  const Icon = getActivityIcon(activity.type);
                  return (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      <div className="w-8 h-8 rounded-lg bg-neutral-50 flex items-center justify-center flex-shrink-0">
                        <Icon className="w-4 h-4 text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {formatDistanceToNow(new Date(activity.timestamp), {
                              addSuffix: true,
                            })}
                          </span>
                          <span className="text-xs text-gray-500">•</span>
                          <span className="text-xs text-gray-500 capitalize">
                            {activity.type}
                          </span>
                        </div>
                      </div>
                      {activity.link && (
                        <a
                          href={activity.link}
                          className="text-xs font-medium text-[#171717] hover:underline flex-shrink-0"
                        >
                          View
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <Activity className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">No activity found</p>
              </div>
            )}
          </SectionCard>
        </div>
      )}

      {/* Preferences Tab */}
      {activeTab === "preferences" && (
        <div className="space-y-6">
          <SectionCard title="Notification Preferences">
            <div className="space-y-4">
              {Object.entries(preferences.notifications).map(([key, value]) => (
                <label
                  key={key}
                  className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {key === "email" && "Receive notifications via email"}
                      {key === "orderUpdates" &&
                        "Get notified about order status changes"}
                      {key === "productAlerts" &&
                        "Receive alerts about product updates"}
                      {key === "securityAlerts" &&
                        "Get notified about security events"}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) =>
                      setPreferences({
                        ...preferences,
                        notifications: {
                          ...preferences.notifications,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 text-[#171717] rounded focus:ring-2 focus:ring-[#171717]"
                  />
                </label>
              ))}
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Language & Region">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Language
                </label>
                <select
                  value={preferences.language}
                  onChange={(e) =>
                    setPreferences({ ...preferences, language: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717]"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-2">
                  Timezone
                </label>
                <select
                  value={preferences.timezone}
                  onChange={(e) =>
                    setPreferences({ ...preferences, timezone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#171717] focus:border-[#171717]"
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">Eastern Time</option>
                  <option value="America/Chicago">Central Time</option>
                  <option value="America/Denver">Mountain Time</option>
                  <option value="America/Los_Angeles">Pacific Time</option>
                </select>
              </div>
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="px-4 py-2 bg-[#171717] hover:bg-[#262626] text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      {/* Advanced Tab */}
      {activeTab === "advanced" && (
        <div className="space-y-6">
          <SectionCard title="Export Data">
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Download a copy of your account data
              </p>
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Export Data
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Delete Account">
            <div className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-lg bg-neutral-50">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Warning
                    </p>
                    <p className="text-xs text-gray-600">
                      Deleting your account will permanently remove all your
                      data. This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 bg-black hover:bg-black text-white rounded-lg text-xs font-medium transition-colors"
              >
                Delete Account
              </button>
            </div>
          </SectionCard>
        </div>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        message="Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently removed."
        confirmText="Delete Account"
        cancelText="Cancel"
        variant="danger"
      />
    </PageContainer>
  );
}
