"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  resolveRoleChrome,
  type RoleChrome,
  type RoleChromePlane,
} from "@/lib/workspace/role-chrome";

export type WorkspaceAccess = {
  loading: boolean;
  signedIn: boolean;
  vendor: boolean;
  admin: boolean;
  vendorIds: string[];
  roleLabel: string | null;
  platformRoleLabel: string | null;
  primaryRoleId: string | null;
  platformRoleId: string | null;
  chromePlane: RoleChromePlane | null;
  chrome: RoleChrome | null;
};

const EMPTY: WorkspaceAccess = {
  loading: true,
  signedIn: false,
  vendor: false,
  admin: false,
  vendorIds: [],
  roleLabel: null,
  platformRoleLabel: null,
  primaryRoleId: null,
  platformRoleId: null,
  chromePlane: null,
  chrome: null,
};

const SIGNED_OUT: WorkspaceAccess = {
  ...EMPTY,
  loading: false,
  signedIn: false,
};

/** One in-flight / cached workspaces fetch for all storefront chrome. */
const CACHE_VERSION = 2;
let cacheKey: string | null = null;
let cacheValue: WorkspaceAccess | null = null;
let inflight: Promise<WorkspaceAccess> | null = null;

function loadWorkspaces(userId: string): Promise<WorkspaceAccess> {
  const key = `${CACHE_VERSION}:${userId}`;
  if (cacheKey === key && cacheValue) {
    return Promise.resolve(cacheValue);
  }
  if (cacheKey === key && inflight) {
    return inflight;
  }

  cacheKey = key;
  inflight = fetch("/api/me/workspaces", { cache: "no-store" })
    .then((r) => r.json())
    .then((body) => {
      const d = body?.data || {};
      const vendor = Boolean(d.vendor);
      const admin = Boolean(d.admin);
      const primaryRoleId = d.primaryRoleId ? String(d.primaryRoleId) : null;
      const platformRoleId = d.platformRoleId
        ? String(d.platformRoleId)
        : null;
      const chrome = resolveRoleChrome({
        staffRole: primaryRoleId,
        platformRole: platformRoleId,
        hasVendor: vendor,
        hasAdmin: admin,
      });
      const next: WorkspaceAccess = {
        loading: false,
        signedIn: true,
        vendor,
        admin,
        vendorIds: Array.isArray(d.vendorIds) ? d.vendorIds.map(String) : [],
        roleLabel: d.roleLabel ? String(d.roleLabel) : null,
        platformRoleLabel: d.platformRoleLabel
          ? String(d.platformRoleLabel)
          : null,
        primaryRoleId,
        platformRoleId,
        chromePlane: (d.chromePlane as RoleChromePlane) || chrome.plane,
        chrome: vendor || admin ? chrome : null,
      };
      cacheValue = next;
      return next;
    })
    .catch(() => {
      const next: WorkspaceAccess = {
        ...EMPTY,
        loading: false,
        signedIn: true,
      };
      cacheValue = next;
      return next;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

/** Role-gated storefront entry to /app and /admin. */
export function useWorkspaceAccess(): WorkspaceAccess {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [state, setState] = useState<WorkspaceAccess>(() => {
    if (!isLoaded) return EMPTY;
    if (!isSignedIn || !userId) return SIGNED_OUT;
    const key = `${CACHE_VERSION}:${userId}`;
    if (cacheKey === key && cacheValue) return cacheValue;
    return { ...EMPTY, signedIn: true };
  });

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn || !userId) {
      cacheKey = null;
      cacheValue = null;
      inflight = null;
      setState(SIGNED_OUT);
      return;
    }

    let cancelled = false;
    const key = `${CACHE_VERSION}:${userId}`;
    if (cacheKey === key && cacheValue) {
      setState(cacheValue);
      return;
    }

    setState((s) => ({ ...s, loading: true, signedIn: true }));
    void loadWorkspaces(userId).then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, userId]);

  return state;
}
