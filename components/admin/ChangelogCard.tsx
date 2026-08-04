"use client";

import { useState, useEffect } from "react";
import { FileText, Plus, X, Check } from "lucide-react";
import SectionCard from "./SectionCard";
import { format } from "date-fns";
import { useToast } from "@/components/ToastProvider";
import { useUser } from "@clerk/nextjs";

interface ChangelogEntry {
  id: string;
  title: string;
  description?: string;
  type: "feature" | "fix" | "update" | "improvement";
  version?: string;
  created_at: string;
  created_by?: string;
}

export default function ChangelogCard() {
  const [entries, setEntries] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: "",
    description: "",
    type: "update" as const,
    version: "",
  });
  const [userRole, setUserRole] = useState<string | null>(null);
  const { user } = useUser();
  const { showToast } = useToast();

  useEffect(() => {
    loadChangelog();
    const meta = user?.publicMetadata?.role;
    if (typeof meta === "string") setUserRole(meta);
    else {
      fetch("/api/admin/current-role")
        .then((r) => r.json())
        .then((d) => setUserRole(d?.role || d?.data?.role || null))
        .catch(() => setUserRole(null));
    }
  }, [user]);

  const loadChangelog = async () => {
    try {
      const response = await fetch("/api/changelog?limit=10");
      const { data } = await response.json();
      setEntries(data || []);
    } catch (error) {
      console.error("Error loading changelog:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEntry = async () => {
    if (!newEntry.title.trim()) {
      showToast("Title is required", "error");
      return;
    }

    try {
      const response = await fetch("/api/changelog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newEntry),
      });

      if (!response.ok) {
        throw new Error("Failed to create changelog entry");
      }

      showToast("Changelog entry added", "success");
      setNewEntry({ title: "", description: "", type: "update", version: "" });
      setShowAddForm(false);
      loadChangelog();
    } catch (error) {
      console.error("Error adding changelog entry:", error);
      showToast("Failed to add changelog entry", "error");
    }
  };

  const getTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      feature: "Feature",
      fix: "Fix",
      update: "Update",
      improvement: "Improvement",
    };
    return labels[type] || "Update";
  };

  const canEdit =
    userRole === "platform_admin" ||
    userRole === "super_admin" ||
    userRole === "admin" ||
    userRole === "head_admin";

  return (
    <SectionCard
      title={
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span>Recent Changes</span>
        </div>
      }
      action={
        canEdit && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-medium text-black hover:underline flex items-center gap-1"
          >
            {showAddForm ? (
              <X className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
            {showAddForm ? "Cancel" : "Add Entry"}
          </button>
        )
      }
    >
      {showAddForm && (
        <div className="mb-4 p-3 border border-gray-200 rounded-lg bg-gray-50">
          <input
            type="text"
            placeholder="Title"
            value={newEntry.title}
            onChange={(e) =>
              setNewEntry({ ...newEntry, title: e.target.value })
            }
            className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
          />
          <textarea
            placeholder="Description (optional)"
            value={newEntry.description}
            onChange={(e) =>
              setNewEntry({ ...newEntry, description: e.target.value })
            }
            className="w-full px-3 py-2 mb-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
            rows={2}
          />
          <div className="flex gap-2 mb-2">
            <select
              value={newEntry.type}
              onChange={(e) =>
                setNewEntry({ ...newEntry, type: e.target.value as any })
              }
              className="px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
            >
              <option value="update">Update</option>
              <option value="feature">Feature</option>
              <option value="fix">Fix</option>
              <option value="improvement">Improvement</option>
            </select>
            <input
              type="text"
              placeholder="Version (optional)"
              value={newEntry.version}
              onChange={(e) =>
                setNewEntry({ ...newEntry, version: e.target.value })
              }
              className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1e3a8a] focus:border-[#1e3a8a]"
            />
          </div>
          <button
            onClick={handleAddEntry}
            className="px-3 py-1.5 bg-black hover:bg-black text-white rounded text-xs font-medium flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            Add Entry
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-[#1e3a8a] border-t-transparent"></div>
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">No changelog entries yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border-l-2 border-gray-200 pl-3 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-gray-500">
                      {getTypeLabel(entry.type)}
                    </span>
                    {entry.version && (
                      <span className="text-xs text-gray-400">
                        v{entry.version}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {entry.title}
                  </p>
                  {entry.description && (
                    <p className="text-xs text-gray-600 mb-2">
                      {entry.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    {format(new Date(entry.created_at), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
