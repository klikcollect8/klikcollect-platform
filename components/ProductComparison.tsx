"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import Image from "next/image";
import { X, Star, Check, XCircle } from "lucide-react";
import Link from "next/link";

interface ProductComparisonProps {
  productIds: string[];
  onClose: () => void;
}

export default function ProductComparison({
  productIds,
  onClose,
}: ProductComparisonProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      productIds.map((id) =>
        fetch(`/api/products/${id}`).then((res) => res.json()),
      ),
    )
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productIds]);

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-4xl w-full mx-4">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#6366f1]"></div>
            <p className="mt-4 text-gray-600">Loading comparison...</p>
          </div>
        </div>
      </div>
    );
  }

  const features = [
    {
      label: "Price",
      key: "price",
      format: (val: number | string) =>
        typeof val === "number" ? `$${val.toFixed(2)}` : String(val),
    },
    {
      label: "Rating",
      key: "rating",
      format: (val: number | string) => {
        const numVal =
          typeof val === "number" ? val : parseFloat(String(val)) || 0;
        return numVal ? `${numVal.toFixed(1)} ⭐` : "N/A";
      },
    },
    {
      label: "Reviews",
      key: "reviewCount",
      format: (val: number | string) => {
        const numVal =
          typeof val === "number" ? val : parseInt(String(val)) || 0;
        return numVal ? numVal.toLocaleString() : "0";
      },
    },
    {
      label: "Stock",
      key: "stock",
      format: (val: number | string) => {
        const numVal =
          typeof val === "number" ? val : parseInt(String(val)) || 0;
        return numVal > 0 ? `${numVal} available` : "Out of stock";
      },
    },
    {
      label: "Category",
      key: "category",
      format: (val: number | string) => String(val),
    },
    {
      label: "Free Delivery",
      key: "price",
      format: (val: number | string) => {
        const numVal =
          typeof val === "number" ? val : parseFloat(String(val)) || 0;
        return numVal > 25 ? "Yes" : "No";
      },
    },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-7xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white">
          <h2 className="text-2xl font-bold">Compare Products</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="p-4 text-left border-b border-gray-200 sticky left-0 bg-white z-10 min-w-[200px]">
                  Features
                </th>
                {products.map((product) => (
                  <th
                    key={product.id}
                    className="p-4 text-center border-b border-gray-200 min-w-[250px]"
                  >
                    <div className="flex flex-col items-center">
                      <button
                        onClick={onClose}
                        className="absolute top-2 right-2 p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                      <div className="relative w-32 h-32 bg-gray-100 mb-3 rounded">
                        <Image
                          src={product.image}
                          alt={product.name}
                          fill
                          className="object-contain p-2"
                        />
                      </div>
                      <Link
                        href={`/products/${product.id}`}
                        className="text-sm font-semibold text-[#6366f1] hover:text-[#7c3aed] mb-2 line-clamp-2"
                      >
                        {product.name}
                      </Link>
                      <div className="flex items-center gap-1 mb-2">
                        {product.rating ? (
                          <>
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs">
                              {product.rating.toFixed(1)}
                            </span>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {features.map((feature, idx) => (
                <tr key={idx} className="border-b border-gray-100">
                  <td className="p-4 font-semibold text-[#0f1111] sticky left-0 bg-white z-10">
                    {feature.label}
                  </td>
                  {products.map((product) => {
                    const value = (product as any)[feature.key];
                    return (
                      <td key={product.id} className="p-4 text-center">
                        {feature.format(
                          value ?? (feature.key === "category" ? "" : 0),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <td className="p-4 font-semibold text-[#0f1111] sticky left-0 bg-white z-10">
                  Actions
                </td>
                {products.map((product) => (
                  <td key={product.id} className="p-4 text-center">
                    <Link
                      href={`/products/${product.id}`}
                      className="inline-block bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] text-white px-4 py-2 rounded-md text-sm font-semibold hover:from-[#4f46e5] hover:to-[#7c3aed] transition-all"
                    >
                      View Details
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
