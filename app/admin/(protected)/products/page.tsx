"use client";

import { useEffect, useState, useMemo } from "react";
import { Product, ProductVariation } from "@/types";
import {
  Plus,
  Edit,
  Trash2,
  X,
  Search,
  Grid,
  List,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  SortAsc,
  SortDesc,
  Filter,
  Info,
  Package,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Tag,
  Star,
  Layers,
  Calendar,
  ExternalLink,
  MoreHorizontal,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import Image from "next/image";
import { format } from "date-fns";
import { useToast } from "@/components/ToastProvider";
import ConfirmDialog from "@/components/ConfirmDialog";
import PageContainer from "@/components/admin/PageContainer";
import AccessControl from "@/components/admin/AccessControl";
import BinButton from "@/components/admin/BinButton";
import SectionCard from "@/components/admin/SectionCard";

type ViewMode = "grid" | "table";
type SortField = "name" | "price" | "stock" | "category" | "createdAt";
type SortOrder = "asc" | "desc";

function ProductsPageContent() {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState<"all" | "in" | "low" | "out">(
    "all",
  );
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [viewProductModal, setViewProductModal] = useState<Product | null>(
    null,
  );
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    productId: string | null;
  }>({
    isOpen: false,
    productId: null,
  });
  const itemsPerPage = 12;

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    longDescription: "",
    price: "",
    image: "",
    images: [] as string[],
    category: "",
    stock: "",
    status: "published" as
      | "draft"
      | "pending_review"
      | "published"
      | "archived",
    badges: [] as string[],
    rating: "",
    reviewCount: "",
    variations: [] as ProductVariation[],
  });

  // Form aux state
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newBadge, setNewBadge] = useState("");
  const [newVariationName, setNewVariationName] = useState("");
  const [newVariationOptions, setNewVariationOptions] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const { showToast } = useToast();

  // Fetch Data
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
      setLoading(false);
    } catch (error) {
      showToast("Failed to load products", "error");
      setLoading(false);
    }
  };

  // Derived State
  const categories = useMemo(() => {
    const cats = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(cats).sort()];
  }, [products]);

  const stats = useMemo(() => {
    return {
      total: products.length,
      inStock: products.filter((p) => (p.stock ?? 0) > 0).length,
      lowStock: products.filter(
        (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 10,
      ).length,
      outOfStock: products.filter((p) => (p.stock ?? 0) === 0).length,
      value: products.reduce(
        (sum, p) => sum + (p.price ?? 0) * (p.stock ?? 0),
        0,
      ),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.category.toLowerCase().includes(q),
      );
    }

    // Filters
    if (categoryFilter !== "All") {
      result = result.filter((p) => p.category === categoryFilter);
    }

    if (stockFilter === "in") {
      result = result.filter((p) => (p.stock ?? 0) > 0);
    } else if (stockFilter === "low") {
      result = result.filter((p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) < 10);
    } else if (stockFilter === "out") {
      result = result.filter((p) => (p.stock ?? 0) === 0);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];

      if (sortField === "name" || sortField === "category") {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      } else if (sortField === "createdAt") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }

      if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
      if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [
    products,
    searchQuery,
    categoryFilter,
    stockFilter,
    sortField,
    sortOrder,
  ]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = editingProduct
      ? `/api/products/${editingProduct.id}`
      : "/api/products";
    const method = editingProduct ? "PUT" : "POST";

    try {
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          longDescription: formData.longDescription || undefined,
          price: Number(formData.price),
          image: formData.image,
          images: formData.images.length > 0 ? formData.images : undefined,
          category: formData.category,
          stock: Number(formData.stock),
          status: formData.status,
          badges: formData.badges.length > 0 ? formData.badges : undefined,
          rating: formData.rating ? Number(formData.rating) : undefined,
          reviewCount: formData.reviewCount
            ? Number(formData.reviewCount)
            : undefined,
          variations:
            formData.variations.length > 0 ? formData.variations : undefined,
        }),
      });

      if (response.ok) {
        showToast(
          editingProduct ? "Updated successfully" : "Created successfully",
          "success",
        );
        fetchProducts();
        resetForm();
      } else {
        const data = await response.json();
        showToast(data.error || "Failed to save", "error");
      }
    } catch {
      showToast("An error occurred", "error");
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      longDescription: product.longDescription || "",
      price: (product.price ?? 0).toString(),
      image: product.image,
      images: product.images || [],
      category: product.category,
      stock: (product.stock ?? 0).toString(),
      status: (product as any).status || "published",
      badges: product.badges || [],
      rating: product.rating?.toString() || "",
      reviewCount: product.reviewCount?.toString() || "",
      variations: product.variations || [],
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteConfirm.productId) return;
    try {
      const res = await fetch(`/api/products/${deleteConfirm.productId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        showToast("Deleted successfully", "success");
        fetchProducts();
        setDeleteConfirm({ isOpen: false, productId: null });
      } else {
        showToast("Failed to delete", "error");
      }
    } catch {
      showToast("An error occurred", "error");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      longDescription: "",
      price: "",
      image: "",
      images: [],
      category: "",
      stock: "",
      status: "published",
      badges: [],
      rating: "",
      reviewCount: "",
      variations: [],
    });
    setEditingProduct(null);
    setShowForm(false);
    setNewImageUrl("");
    setNewBadge("");
    setNewVariationName("");
    setNewVariationOptions("");
  };

  // Helper actions
  const addImage = () => {
    if (newImageUrl.trim()) {
      setFormData((prev) => ({
        ...prev,
        images: [...prev.images, newImageUrl.trim()],
      }));
      setNewImageUrl("");
    }
  };

  const removeImage = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  };

  const addBadge = () => {
    if (newBadge.trim()) {
      setFormData((prev) => ({
        ...prev,
        badges: [...prev.badges, newBadge.trim()],
      }));
      setNewBadge("");
    }
  };

  const removeBadge = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      badges: prev.badges.filter((_, i) => i !== index),
    }));
  };

  const addVariation = () => {
    if (newVariationName.trim() && newVariationOptions.trim()) {
      const options = newVariationOptions
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean);
      setFormData((prev) => ({
        ...prev,
        variations: [
          ...prev.variations,
          { name: newVariationName.trim(), options },
        ],
      }));
      setNewVariationName("");
      setNewVariationOptions("");
    }
  };

  const removeVariation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      variations: prev.variations.filter((_, i) => i !== index),
    }));
  };

  if (loading) return null;

  return (
    <PageContainer className="max-w-[1400px] px-6 py-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-light tracking-tight text-neutral-900">
            Products
          </h1>
          <p className="text-neutral-500 font-light mt-2">
            Manage your inventory and catalog.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <BinButton itemType="product" onRestore={fetchProducts} />
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 text-white rounded-full text-sm font-medium hover:bg-neutral-800 transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Product
          </button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {[
          { label: "Total Products", value: stats.total, filter: "all" },
          { label: "In Stock", value: stats.inStock, filter: "in" },
          {
            label: "Low Stock",
            value: stats.lowStock,
            alert: stats.lowStock > 0,
            filter: "low",
          },
          {
            label: "Out of Stock",
            value: stats.outOfStock,
            alert: stats.outOfStock > 0,
            filter: "out",
          },
        ].map((stat, i) => {
          const isActive = stockFilter === stat.filter;
          return (
            <button
              key={i}
              onClick={() => {
                setStockFilter(stat.filter as any);
                setCurrentPage(1);
              }}
              className={`p-5 rounded-2xl border text-left transition-all duration-200 ${
                isActive
                  ? "ring-1 ring-neutral-300 border-neutral-300 bg-neutral-50"
                  : `bg-white hover:border-neutral-300 hover:shadow-sm ${stat.alert ? "border-black/10 bg-black/[0.04]/30" : "border-neutral-100"}`
              }`}
            >
              <p
                className={`text-xs font-medium uppercase tracking-wider mb-1 ${
                  stat.alert ? "text-black/55" : "text-neutral-500"
                }`}
              >
                {stat.label}
              </p>
              <p
                className={`text-2xl font-light ${
                  stat.alert ? "text-black" : "text-neutral-900"
                }`}
              >
                {stat.value}
              </p>
            </button>
          );
        })}
      </div>

      {/* Controls */}
      <div className="sticky top-4 z-20 mb-8 space-y-4">
        <div className="bg-white/80 backdrop-blur-xl border border-neutral-200/60 p-2 rounded-2xl shadow-sm flex flex-col md:flex-row gap-2">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-transparent text-sm focus:outline-none placeholder:text-neutral-400"
            />
          </div>

          {/* Filters Divider */}
          <div className="w-px h-8 bg-neutral-200 hidden md:block" />

          {/* Filter Controls */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 hide-scrollbar">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={stockFilter}
              onChange={(e) => setStockFilter(e.target.value as any)}
              className="px-3 py-2 bg-neutral-50 border-none rounded-xl text-sm font-medium text-neutral-700 focus:ring-0 cursor-pointer hover:bg-neutral-100 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>

            <div className="w-px h-8 bg-neutral-200 hidden md:block mx-1" />

            {/* View Mode */}
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

      {/* Content Area */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {paginatedProducts.map((product) => (
            <div
              key={product.id}
              onClick={() => handleEdit(product)}
              className="group bg-white rounded-2xl border border-neutral-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
            >
              {/* Image */}
              <div className="relative aspect-square bg-neutral-50 overflow-hidden">
                <Image
                  src={product.image}
                  alt={product.name}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute top-3 left-3 flex flex-col gap-2">
                  <span
                    className={`px-2 py-1 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm ${
                      (product as any).status === "published"
                        ? "bg-black/[0.04]0/90"
                        : (product as any).status === "draft"
                          ? "bg-neutral-500/90"
                          : (product as any).status === "pending_review"
                            ? "bg-black/[0.04]0/90"
                            : "bg-black/[0.04]0/90"
                    }`}
                  >
                    {(product as any).status || "published"}
                  </span>
                </div>
                <div className="absolute top-3 right-3 flex flex-col gap-2">
                  {(product.stock ?? 0) === 0 ? (
                    <span className="px-2 py-1 bg-black/[0.04]0/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                      Sold Out
                    </span>
                  ) : (product.stock ?? 0) < 10 ? (
                    <span className="px-2 py-1 bg-black/[0.04]0/90 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm">
                      Low Stock
                    </span>
                  ) : null}
                </div>

                {/* Hover Actions */}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(product);
                    }}
                    className="p-2 bg-white text-neutral-900 rounded-full hover:bg-neutral-100 transition-colors shadow-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirm({ isOpen: true, productId: product.id });
                    }}
                    className="p-2 bg-white text-black/55 rounded-full hover:bg-black/[0.04] transition-colors shadow-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <div className="flex justify-between items-start gap-4 mb-2">
                  <div>
                    <p className="text-xs font-medium text-neutral-500 mb-1">
                      {product.category}
                    </p>
                    <h3 className="font-medium text-neutral-900 line-clamp-1 group-hover:text-black transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <p className="font-semibold text-neutral-900">
                    ${product.price}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-100">
                  <div className="flex items-center gap-1.5 text-xs text-neutral-500">
                    <Package className="w-3.5 h-3.5" />
                    <span>{product.stock} in stock</span>
                  </div>
                  {product.rating && (
                    <div className="flex items-center gap-1 text-xs font-medium text-neutral-700">
                      <Star className="w-3 h-3 fill-neutral-900 text-neutral-900" />
                      {product.rating}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-neutral-100 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Price
                </th>
                <th className="px-6 py-4 text-xs font-medium text-neutral-500 uppercase tracking-wider text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {paginatedProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-neutral-50/50 transition-colors group cursor-pointer"
                  onClick={() => handleEdit(product)}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-neutral-100">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-cover"
                        />
                      </div>
                      <span className="font-medium text-neutral-900">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-600 text-xs font-medium">
                      {product.category}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div
                        className={`w-2 h-2 rounded-full ${
                          (product.stock ?? 0) === 0
                            ? "bg-black/[0.04]0"
                            : (product.stock ?? 0) < 10
                              ? "bg-black/[0.04]0"
                              : "bg-black/[0.04]0"
                        }`}
                      />
                      <span className="text-sm text-neutral-600">
                        {product.stock ?? 0} units
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-neutral-900">
                    ${(product.price ?? 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(product);
                        }}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({
                            isOpen: true,
                            productId: product.id,
                          });
                        }}
                        className="p-1.5 text-neutral-500 hover:text-black/55 hover:bg-black/[0.04] rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center mt-12 gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 disabled:opacity-30 disabled:hover:border-neutral-200 transition-all"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-4 py-2 rounded-xl bg-neutral-50 text-neutral-600 text-sm font-medium flex items-center">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-xl border border-neutral-200 text-neutral-500 hover:text-neutral-900 hover:border-neutral-300 disabled:opacity-30 disabled:hover:border-neutral-200 transition-all"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Create / edit catalogue product */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-6">
          <button
            type="button"
            className="absolute inset-0"
            aria-label="Close"
            onClick={() => setShowForm(false)}
          />
          <div className="relative z-10 flex max-h-[92vh] w-full max-w-2xl flex-col border border-black/10 bg-[#f7f7f5] shadow-none sm:max-h-[88vh]">
            <div className="flex items-start justify-between gap-3 border-b border-black/10 px-5 py-4 sm:px-8">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-black/35">
                  Catalogue
                </p>
                <h2 className="mt-1 text-[20px] font-medium tracking-tight text-black">
                  {editingProduct ? "Edit product" : "New product"}
                </h2>
                <p className="mt-1 max-w-md text-[13px] leading-snug text-black/45">
                  Platform catalogue item. Vendors attach their own prices and
                  stock as offers after publish.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="inline-flex h-10 w-10 items-center justify-center text-black/40 hover:text-black"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8">
              <form id="admin-product-form" onSubmit={handleSubmit} className="space-y-8">
                <div className="flex flex-col gap-5 sm:flex-row">
                  <div className="relative h-36 w-full shrink-0 overflow-hidden border border-dashed border-black/15 bg-black/[0.02] sm:h-36 sm:w-36">
                    {formData.image ? (
                      <Image
                        src={formData.image}
                        alt="Preview"
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 text-black/30">
                        <ImageIcon className="h-7 w-7" strokeWidth={1.5} />
                        <span className="text-[11px] uppercase tracking-[0.14em]">
                          Image
                        </span>
                      </div>
                    )}
                    <label className="absolute inset-0 cursor-pointer bg-black/0 transition-colors hover:bg-black/10">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingImage(true);
                          const fd = new FormData();
                          fd.append("file", file);
                          try {
                            const res = await fetch("/api/upload", {
                              method: "POST",
                              body: fd,
                            });
                            const data = await res.json();
                            if (data.url)
                              setFormData((p) => ({ ...p, image: data.url }));
                          } finally {
                            setUploadingImage(false);
                          }
                        }}
                      />
                    </label>
                    {uploadingImage ? (
                      <span className="absolute bottom-2 left-2 bg-white/95 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-black/60">
                        Uploading…
                      </span>
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1 space-y-4">
                    <label className="block space-y-1.5">
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                        Name
                      </span>
                      <input
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData((p) => ({ ...p, name: e.target.value }))
                        }
                        className="w-full border border-black/12 bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-black/40"
                        placeholder="e.g. Brookside Fresh Milk 500ml"
                        autoFocus
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                          Guide price (KES)
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          required
                          value={formData.price}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              price: e.target.value,
                            }))
                          }
                          className="w-full border border-black/12 bg-transparent px-3 py-2.5 text-[14px] tabular-nums outline-none focus:border-black/40"
                          placeholder="0"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                          Seed stock
                        </span>
                        <input
                          type="number"
                          min="0"
                          required
                          value={formData.stock}
                          onChange={(e) =>
                            setFormData((p) => ({
                              ...p,
                              stock: e.target.value,
                            }))
                          }
                          className="w-full border border-black/12 bg-transparent px-3 py-2.5 text-[14px] tabular-nums outline-none focus:border-black/40"
                          placeholder="0"
                        />
                      </label>
                    </div>
                    <p className="text-[12px] leading-snug text-black/40">
                      Guide price is a catalogue reference. Live shop prices
                      come from vendor offers.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                      Category
                    </span>
                    <input
                      required
                      value={formData.category}
                      onChange={(e) =>
                        setFormData((p) => ({ ...p, category: e.target.value }))
                      }
                      className="w-full border border-black/12 bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-black/40"
                      placeholder="e.g. Dairy"
                      list="admin-product-categories"
                    />
                    <datalist id="admin-product-categories">
                      {Array.from(
                        new Set(
                          products
                            .map((p) => p.category)
                            .filter(Boolean) as string[],
                        ),
                      )
                        .slice(0, 40)
                        .map((c) => (
                          <option key={c} value={c} />
                        ))}
                    </datalist>
                  </label>
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                      Status
                    </span>
                    <div className="grid grid-cols-2 gap-1 border border-black/12 p-1 sm:grid-cols-4">
                      {(
                        [
                          ["draft", "Draft"],
                          ["pending_review", "Review"],
                          ["published", "Live"],
                          ["archived", "Archive"],
                        ] as const
                      ).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({ ...p, status: value }))
                          }
                          className={`min-h-9 px-2 text-[11px] font-medium uppercase tracking-[0.1em] transition-colors ${
                            formData.status === value
                              ? "bg-black text-white"
                              : "text-black/45 hover:text-black"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                    Short description
                  </span>
                  <textarea
                    required
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        description: e.target.value,
                      }))
                    }
                    className="w-full resize-none border border-black/12 bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-black/40"
                    placeholder="What shoppers see under the title"
                  />
                </label>

                <label className="block space-y-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                    Long description (optional)
                  </span>
                  <textarea
                    rows={4}
                    value={formData.longDescription}
                    onChange={(e) =>
                      setFormData((p) => ({
                        ...p,
                        longDescription: e.target.value,
                      }))
                    }
                    className="w-full resize-none border border-black/12 bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-black/40"
                    placeholder="Ingredients, size, origin…"
                  />
                </label>

                <div>
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/40">
                    Badges
                  </span>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={newBadge}
                      onChange={(e) => setNewBadge(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && (e.preventDefault(), addBadge())
                      }
                      className="min-w-0 flex-1 border border-black/12 bg-transparent px-3 py-2.5 text-[14px] outline-none focus:border-black/40"
                      placeholder="e.g. Organic"
                    />
                    <button
                      type="button"
                      onClick={addBadge}
                      className="min-h-11 shrink-0 border border-black/12 px-4 text-[11px] font-medium uppercase tracking-[0.12em] text-black/70 hover:border-black/30"
                    >
                      Add
                    </button>
                  </div>
                  {formData.badges.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {formData.badges.map((b, i) => (
                        <span
                          key={`${b}-${i}`}
                          className="inline-flex items-center gap-1.5 border border-black/10 px-2.5 py-1 text-[12px] text-black/70"
                        >
                          {b}
                          <button
                            type="button"
                            onClick={() => removeBadge(i)}
                            className="text-black/35 hover:text-black"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </form>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-black/10 px-5 py-3 sm:px-8">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="min-h-11 px-4 text-[12px] font-medium uppercase tracking-[0.12em] text-black/45 hover:text-black"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="admin-product-form"
                className="inline-flex min-h-11 items-center bg-black px-6 text-[12px] font-medium uppercase tracking-[0.14em] text-white hover:opacity-80"
              >
                {editingProduct ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Product"
        message="Are you sure? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, productId: null })}
      />
    </PageContainer>
  );
}

export default function ProductsPage() {
  return (
    <AccessControl requiredPermission="products:view">
      <ProductsPageContent />
    </AccessControl>
  );
}
