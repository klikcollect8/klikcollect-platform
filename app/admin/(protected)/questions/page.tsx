"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { ProductQuestion, Product } from "@/types";
import {
  Trash2,
  MessageSquare,
  Search,
  Plus,
  X,
  LayoutGrid,
  Table as TableIcon,
  HelpCircle,
  Calendar,
  User,
  Package,
  ExternalLink,
  CheckCircle,
  CheckSquare,
  Square,
  Reply,
  Send,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import Image from "next/image";
import Link from "next/link";
import PageContainer from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import BinButton from "@/components/admin/BinButton";
import SectionCard from "@/components/admin/SectionCard";
import { useToast } from "@/components/ToastProvider";
import ConfirmDialog from "@/components/ConfirmDialog";

type ViewMode = "grid" | "table";

function QuestionsContent() {
  const [questions, setQuestions] = useState<ProductQuestion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProduct, setFilterProduct] = useState("all");
  const [filterStatus, setFilterStatus] = useState<
    "all" | "answered" | "unanswered"
  >("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  // Selection & Modal
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedQuestion, setSelectedQuestion] =
    useState<ProductQuestion | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Confirmation
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    type: "delete" | "bulk-delete" | "delete-answer";
    itemId: string | null;
    meta?: any;
  }>({
    isOpen: false,
    type: "delete",
    itemId: null,
  });

  const { showToast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [productsRes, questionsRes] = await Promise.all([
        fetch("/api/products")
          .then((r) => r.json())
          .catch(() => []),
        fetch("/api/questions")
          .then((r) => r.json())
          .catch(() => []),
      ]);

      setProducts(Array.isArray(productsRes) ? productsRes : []);
      setQuestions(Array.isArray(questionsRes) ? questionsRes : []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
      showToast("Failed to load questions", "error");
    } finally {
      setLoading(false);
    }
  };

  const getProduct = (productId: string) =>
    products.find((p) => p.id === productId);

  // --- Actions ---

  const handleDeleteQuestion = async () => {
    const id = confirmDialog.itemId;
    if (!id) return;

    const question = questions.find((q) => q.id === id);
    if (!question) return;

    try {
      // Optimistic update
      setQuestions((prev) => prev.filter((q) => q.id !== id));
      if (selectedQuestion?.id === id) setSelectedQuestion(null);
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

      const response = await fetch(
        `/api/products/${question.productId}/questions/${id}`,
        {
          method: "DELETE",
        },
      );

      if (response.ok) {
        showToast("Question moved to bin", "success");
      } else {
        fetchData(); // Revert
        showToast("Failed to delete question", "error");
      }
    } catch {
      fetchData();
      showToast("An error occurred", "error");
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      setQuestions((prev) => prev.filter((q) => !ids.includes(q.id)));
      setSelectedIds(new Set());
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

      const questionsToDelete = questions.filter((q) => ids.includes(q.id));

      await Promise.all(
        questionsToDelete.map((q) =>
          fetch(`/api/products/${q.productId}/questions/${q.id}`, {
            method: "DELETE",
          }),
        ),
      );

      showToast(`${ids.length} questions moved to bin`, "success");
    } catch {
      fetchData();
      showToast("Failed to delete questions", "error");
    }
  };

  const handleAddAnswer = async (question: ProductQuestion) => {
    if (!replyText.trim()) return;

    try {
      setSubmittingReply(true);
      const response = await fetch(
        `/api/products/${question.productId}/questions/${question.id}/answers`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userName: "Admin",
            answer: replyText.trim(),
          }),
        },
      );

      if (response.ok) {
        showToast("Answer posted successfully", "success");
        setReplyText("");

        // Optimistic update for immediate feedback
        const newAnswer = {
          id: "temp-" + Date.now(),
          userName: "Admin",
          answer: replyText.trim(),
          createdAt: new Date().toISOString(),
          helpfulCount: 0,
        };
        const updatedQuestion = {
          ...question,
          answers: [...(question.answers || []), newAnswer],
        };
        setSelectedQuestion(updatedQuestion);
        setQuestions((prev) =>
          prev.map((q) => (q.id === question.id ? updatedQuestion : q)),
        );

        // Background refresh to get real ID
        fetchData().then(() => {
          // Note: In a real app we'd reconcile the temp ID, but here we just refresh content
        });
      } else {
        showToast("Failed to post answer", "error");
      }
    } catch {
      showToast("An error occurred", "error");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleDeleteAnswer = async () => {
    const { questionId, answerId, productId } = confirmDialog.meta || {};
    if (!questionId || !answerId || !productId) return;

    try {
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === questionId) {
            return {
              ...q,
              answers: q.answers.filter((a) => a.id !== answerId),
            };
          }
          return q;
        }),
      );
      if (selectedQuestion?.id === questionId) {
        setSelectedQuestion((prev) =>
          prev
            ? {
                ...prev,
                answers: prev.answers.filter((a) => a.id !== answerId),
              }
            : null,
        );
      }
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

      await fetch(
        `/api/products/${productId}/questions/${questionId}/answers/${answerId}`,
        {
          method: "DELETE",
        },
      );

      showToast("Answer deleted", "success");
    } catch {
      fetchData();
      showToast("Failed to delete answer", "error");
    }
  };

  // --- Filtering & Stats ---

  const stats = useMemo(() => {
    return {
      total: questions.length,
      unanswered: questions.filter((q) => q.answers.length === 0).length,
      answered: questions.filter((q) => q.answers.length > 0).length,
      totalAnswers: questions.reduce((sum, q) => sum + q.answers.length, 0),
    };
  }, [questions]);

  const filteredQuestions = useMemo(() => {
    let result = questions;

    if (filterProduct !== "all") {
      result = result.filter((q) => q.productId === filterProduct);
    }

    if (filterStatus === "answered") {
      result = result.filter((q) => q.answers.length > 0);
    } else if (filterStatus === "unanswered") {
      result = result.filter((q) => q.answers.length === 0);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (q) =>
          q.userName.toLowerCase().includes(query) ||
          q.question.toLowerCase().includes(query) ||
          q.answers.some((a) => a.answer.toLowerCase().includes(query)),
      );
    }

    return result.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [questions, filterProduct, filterStatus, searchQuery]);

  // --- Selection ---

  const toggleSelect = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredQuestions.length)
      setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
  };

  if (loading) return null;

  return (
    <PageContainer className="max-w-[1600px] px-6 py-12 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">
            Q&A
          </h1>
          <p className="text-neutral-500 font-light mt-2">
            Manage customer questions and provide answers.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BinButton
            itemType="answer"
            title="Answers Bin"
            filterByQuestionId={true}
            onRestore={fetchData}
          />
          <BinButton itemType="question" onRestore={fetchData} />
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          {
            label: "Total Questions",
            value: stats.total,
            icon: HelpCircle,
            filter: "all",
          },
          {
            label: "Unanswered",
            value: stats.unanswered,
            icon: MessageSquare,
            filter: "unanswered",
            alert: stats.unanswered > 0,
          },
          {
            label: "Answered",
            value: stats.answered,
            icon: CheckCircle,
            filter: "answered",
          },
          {
            label: "Total Replies",
            value: stats.totalAnswers,
            icon: Reply,
            filter: "all",
          },
        ].map((stat, i) => (
          <button
            key={i}
            onClick={() =>
              stat.filter !== "all" && setFilterStatus(stat.filter as any)
            }
            className={`p-5 rounded-2xl border text-left transition-all duration-200 ${
              filterStatus === stat.filter
                ? "ring-1 ring-neutral-300 border-neutral-300 bg-neutral-50"
                : `bg-white hover:border-neutral-300 hover:shadow-sm ${stat.alert ? "border-black/10 bg-black/[0.04]/30" : "border-neutral-100"}`
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <p
                className={`text-xs font-medium uppercase tracking-wider ${stat.alert ? "text-black/60" : "text-neutral-500"}`}
              >
                {stat.label}
              </p>
              <stat.icon
                className={`w-4 h-4 ${stat.alert ? "text-black/55" : "text-neutral-400"}`}
              />
            </div>
            <p
              className={`text-2xl font-light ${stat.alert ? "text-black" : "text-neutral-900"}`}
            >
              {stat.value}
            </p>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="sticky top-4 z-20 mb-8 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search questions, users, products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
            />
          </div>

          <div className="w-px h-8 bg-neutral-200 hidden md:block" />

          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <select
              value={filterProduct}
              onChange={(e) => setFilterProduct(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors max-w-[150px]"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="answered">Answered</option>
              <option value="unanswered">Unanswered</option>
            </select>

            <div className="w-px h-8 bg-neutral-200 hidden md:block mx-1" />

            <div className="flex bg-neutral-100 rounded-xl p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "grid" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-600"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-1.5 rounded-lg transition-all ${viewMode === "table" ? "bg-white shadow-sm text-neutral-900" : "text-neutral-400 hover:text-neutral-600"}`}
              >
                <TableIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white border border-neutral-200 shadow-2xl rounded-full px-6 py-3 flex items-center gap-4 z-40 animate-in slide-in-from-bottom-6 fade-in">
          <span className="text-sm font-medium text-neutral-900 border-r border-neutral-200 pr-4">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setConfirmDialog({
                  isOpen: true,
                  type: "bulk-delete",
                  itemId: null,
                })
              }
              className="p-2 text-neutral-400 hover:text-black/55 rounded-lg transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-xs font-medium">Delete Selected</span>
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-2 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Select All */}
      <div className="flex items-center gap-2 mb-4 px-2">
        <button
          onClick={toggleSelectAll}
          className="flex items-center gap-2 text-xs font-medium text-neutral-500 hover:text-neutral-900 transition-colors"
        >
          {selectedIds.size === filteredQuestions.length &&
          filteredQuestions.length > 0 ? (
            <CheckSquare className="w-4 h-4 text-neutral-900" />
          ) : (
            <Square className="w-4 h-4" />
          )}
          Select All
        </button>
      </div>

      {/* Content Grid/Table */}
      {filteredQuestions.length === 0 ? (
        <SectionCard>
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-neutral-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <HelpCircle className="w-8 h-8 text-neutral-300" />
            </div>
            <h3 className="text-lg font-medium text-neutral-900 mb-1">
              No Questions Found
            </h3>
            <p className="text-neutral-500 text-sm">
              Try adjusting your filters or search terms.
            </p>
          </div>
        </SectionCard>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-24">
          {filteredQuestions.map((question) => {
            const product = getProduct(question.productId);
            const isSelected = selectedIds.has(question.id);
            const isUnanswered = question.answers.length === 0;

            return (
              <div
                key={question.id}
                onClick={() => setSelectedQuestion(question)}
                className={`bg-white rounded-2xl border p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group cursor-pointer relative flex flex-col h-full ${
                  isSelected
                    ? "border-neutral-300 ring-1 ring-neutral-200"
                    : "border-neutral-100"
                }`}
              >
                {/* Selection Checkbox */}
                <button
                  onClick={(e) => toggleSelect(question.id, e)}
                  className="absolute top-6 right-6 p-1 text-neutral-300 hover:text-neutral-900 transition-colors z-10"
                >
                  {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-neutral-900" />
                  ) : (
                    <Square className="w-5 h-5" />
                  )}
                </button>

                {/* Header: User & Time */}
                <div className="flex items-start justify-between mb-4 pr-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-50 flex items-center justify-center border border-neutral-100 text-neutral-600 font-medium">
                      {question.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-neutral-900">
                        {question.userName}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {formatDistanceToNow(new Date(question.createdAt), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Question Text */}
                <div className="flex-1 mb-4">
                  <div className="flex items-start gap-2 mb-2">
                    <HelpCircle className="w-4 h-4 text-neutral-300 mt-1 shrink-0" />
                    <h3 className="font-medium text-neutral-900 line-clamp-3 leading-relaxed">
                      {question.question}
                    </h3>
                  </div>

                  {isUnanswered ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/[0.04] text-black/60 text-xs font-medium border border-black/10">
                      Needs Answer
                    </span>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-neutral-500 mt-2 pl-6">
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>
                        {question.answers.length} answer
                        {question.answers.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Footer: Product */}
                <div className="pt-4 border-t border-neutral-50 flex items-center gap-3 mt-auto">
                  {product && (
                    <>
                      <div className="w-10 h-10 rounded-lg bg-neutral-100 relative overflow-hidden shrink-0">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-neutral-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-neutral-400">
                          {product.category}
                        </p>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Actions (Hover) */}
                <div className="absolute top-6 right-14 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedQuestion(question);
                    }}
                    className="p-1 text-neutral-400 hover:text-neutral-900"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm pb-24">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 w-12">
                  <button
                    onClick={toggleSelectAll}
                    className="text-neutral-400 hover:text-neutral-900"
                  >
                    {selectedIds.size === filteredQuestions.length &&
                    filteredQuestions.length > 0 ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Question
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredQuestions.map((question) => {
                const product = getProduct(question.productId);
                const isSelected = selectedIds.has(question.id);
                const isUnanswered = question.answers.length === 0;

                return (
                  <tr
                    key={question.id}
                    onClick={() => setSelectedQuestion(question)}
                    className={`hover:bg-neutral-50/50 transition-colors cursor-pointer ${isSelected ? "bg-neutral-50" : ""}`}
                  >
                    <td
                      className="px-6 py-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => toggleSelect(question.id, e)}
                        className="text-neutral-300 hover:text-neutral-900"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-neutral-900" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-600 font-medium">
                          {question.userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-neutral-900">
                          {question.userName}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <p className="text-sm text-neutral-600 truncate">
                        {question.question}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {isUnanswered ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/[0.04] text-black/60 border border-black/10">
                          Unanswered
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-black/[0.04] text-black border border-black/10">
                          Answered ({question.answers.length})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {product ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-neutral-100 relative overflow-hidden shrink-0">
                            <Image
                              src={product.image}
                              alt=""
                              fill
                              className="object-cover"
                            />
                          </div>
                          <span className="text-sm text-neutral-600 truncate max-w-[150px]">
                            {product.name}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-neutral-400">
                          Unknown Product
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-neutral-500">
                        {format(new Date(question.createdAt), "MMM d, yyyy")}
                      </span>
                    </td>
                    <td
                      className="px-6 py-4 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          setConfirmDialog({
                            isOpen: true,
                            type: "delete",
                            itemId: question.id,
                          })
                        }
                        className="p-1.5 text-neutral-400 hover:text-black/55 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail Modal (Centered Premium) */}
      {selectedQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="fixed inset-0 bg-neutral-900/40 backdrop-blur-md transition-opacity animate-in fade-in duration-300"
            onClick={() => setSelectedQuestion(null)}
          />

          <div className="relative w-full max-w-4xl bg-white shadow-2xl shadow-neutral-900/20 rounded-[2rem] flex flex-col max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-4 duration-300 overflow-hidden ring-1 ring-black/5">
            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-neutral-100 flex items-center justify-between bg-white/80 backdrop-blur-xl z-10 shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center border border-neutral-200">
                  <span className="text-xl font-light text-neutral-600">
                    {selectedQuestion.userName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h2 className="text-xl font-medium text-neutral-900">
                    {selectedQuestion.userName}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <span>
                      {format(
                        new Date(selectedQuestion.createdAt),
                        "MMMM d, yyyy",
                      )}
                    </span>
                    <span className="text-neutral-300">•</span>
                    <span>
                      {format(new Date(selectedQuestion.createdAt), "h:mm a")}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedQuestion(null)}
                className="group p-2.5 rounded-full hover:bg-neutral-100 transition-all duration-200"
              >
                <X className="w-5 h-5 text-neutral-400 group-hover:text-neutral-900" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto bg-neutral-50/30">
              <div className="grid grid-cols-1 lg:grid-cols-3 min-h-full">
                {/* Left: Product Info */}
                <div className="lg:col-span-1 p-8 border-r border-neutral-100 bg-white">
                  {(() => {
                    const product = getProduct(selectedQuestion.productId);
                    if (!product) return null;
                    return (
                      <div className="sticky top-0 space-y-6">
                        <div className="aspect-square relative rounded-2xl overflow-hidden bg-neutral-100 border border-neutral-100 shadow-sm">
                          <Image
                            src={product.image}
                            alt={product.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div>
                          <h3 className="font-medium text-neutral-900 text-lg mb-1">
                            {product.name}
                          </h3>
                          <p className="text-neutral-500 text-sm mb-4">
                            {product.category}
                          </p>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-neutral-100 rounded-lg text-sm font-medium text-neutral-900">
                              ${(product.price ?? 0).toFixed(2)}
                            </span>
                            <Link
                              href={`/products/${product.id}`}
                              target="_blank"
                              className="text-sm text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 transition-colors"
                            >
                              View on site{" "}
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Right: Question Content & Answers */}
                <div className="lg:col-span-2 p-8 space-y-8">
                  {/* Question */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-5 h-5 text-neutral-900" />
                      <span className="text-sm font-bold uppercase tracking-wider text-neutral-900">
                        Question
                      </span>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
                      <p className="text-lg text-neutral-900 leading-relaxed font-light">
                        {selectedQuestion.question}
                      </p>
                    </div>
                  </div>

                  {/* Answers Section */}
                  <div className="space-y-6 pt-6 border-t border-neutral-200/50">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-neutral-900 flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        Answers ({selectedQuestion.answers?.length || 0})
                      </h4>
                      {selectedQuestion.answers.length === 0 && (
                        <span className="text-xs font-bold uppercase tracking-wider text-black/60 bg-black/[0.04] px-2 py-1 rounded-full">
                          Pending Reply
                        </span>
                      )}
                    </div>

                    {/* Existing Answers */}
                    <div className="space-y-4">
                      {selectedQuestion.answers?.map((answer) => (
                        <div
                          key={answer.id}
                          className="bg-neutral-100/50 rounded-2xl p-5 border border-neutral-100 relative group"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-5 h-5 rounded-full bg-neutral-200 flex items-center justify-center text-[10px] font-bold text-neutral-600">
                                {answer.userName.charAt(0)}
                              </div>
                              <span className="font-medium text-sm text-neutral-900">
                                {answer.userName}
                              </span>
                              <span className="text-xs text-neutral-400">
                                •{" "}
                                {formatDistanceToNow(
                                  new Date(answer.createdAt),
                                  { addSuffix: true },
                                )}
                              </span>
                            </div>
                            <button
                              onClick={() =>
                                setConfirmDialog({
                                  isOpen: true,
                                  type: "delete-answer",
                                  itemId: null,
                                  meta: {
                                    questionId: selectedQuestion.id,
                                    answerId: answer.id,
                                    productId: selectedQuestion.productId,
                                  },
                                })
                              }
                              className="p-1.5 text-neutral-300 hover:text-black/55 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-sm text-neutral-600 leading-relaxed">
                            {answer.answer}
                          </p>
                        </div>
                      ))}
                    </div>

                    {/* Add Answer */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-neutral-900 flex items-center justify-center shrink-0 mt-1">
                        <Reply className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 space-y-3">
                        <textarea
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                          placeholder="Write an answer..."
                          className="w-full p-4 bg-white border border-neutral-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-neutral-900/5 focus:border-neutral-300 resize-none transition-all placeholder:text-neutral-400 min-h-[100px]"
                        />
                        <div className="flex justify-end">
                          <button
                            onClick={() => handleAddAnswer(selectedQuestion)}
                            disabled={!replyText.trim() || submittingReply}
                            className="px-6 py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-medium hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-neutral-900/10 flex items-center gap-2"
                          >
                            {submittingReply ? (
                              <span className="animate-pulse">Posting...</span>
                            ) : (
                              <>
                                <Send className="w-4 h-4" /> Post Answer
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-5 border-t border-neutral-100 bg-white flex justify-between items-center z-10 shrink-0">
              <span className="text-xs text-neutral-400 font-mono">
                ID: {selectedQuestion.id}
              </span>
              <button
                onClick={() =>
                  setConfirmDialog({
                    isOpen: true,
                    type: "delete",
                    itemId: selectedQuestion.id,
                  })
                }
                className="flex items-center gap-2 px-5 py-2.5 bg-black/[0.04] text-black/55 rounded-xl text-sm font-medium hover:bg-black/[0.06] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete Question
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={
          confirmDialog.type === "delete-answer"
            ? "Delete Answer"
            : "Delete Question"
        }
        message="Are you sure? This will move the item to the bin."
        confirmText="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDialog.type === "delete-answer") handleDeleteAnswer();
          else if (confirmDialog.type === "bulk-delete") handleBulkDelete();
          else handleDeleteQuestion();
        }}
        onCancel={() =>
          setConfirmDialog({ isOpen: false, type: "delete", itemId: null })
        }
      />
    </PageContainer>
  );
}

export default function QuestionsPage() {
  return (
    <AccessControl requiredPermission="content:moderate">
      <Suspense fallback={null}>
        <QuestionsContent />
      </Suspense>
    </AccessControl>
  );
}
