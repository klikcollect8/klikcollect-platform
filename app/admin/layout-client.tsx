"use client";

/**
 * Client-side admin layout wrapper
 * Note: AdminNav, AdminFooter, and AdminProfileButton are rendered by parent AdminLayout
 * This component just wraps children without duplicating navigation
 */
export default function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  // Just return children - parent AdminLayout already provides AdminNav, Footer, etc.
  return <>{children}</>;
}
