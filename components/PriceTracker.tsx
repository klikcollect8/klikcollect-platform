"use client";

import { useState, useEffect } from "react";
import { Product } from "@/types";
import { Bell, BellOff, TrendingDown } from "lucide-react";
import { useToast } from "./ToastProvider";

interface PriceTrackerProps {
  product: Product;
}

export default function PriceTracker({ product }: PriceTrackerProps) {
  const [tracking, setTracking] = useState(false);
  const [targetPrice, setTargetPrice] = useState((product.price ?? 0) * 0.9);
  const { showToast } = useToast();

  useEffect(() => {
    const tracked = JSON.parse(localStorage.getItem("priceTracking") || "{}");
    setTracking(!!tracked[product.id]);
    if (tracked[product.id]) {
      setTargetPrice(tracked[product.id].targetPrice);
    }
  }, [product.id]);

  const toggleTracking = () => {
    const tracked = JSON.parse(localStorage.getItem("priceTracking") || "{}");

    if (tracking) {
      delete tracked[product.id];
      showToast("Price tracking removed", "info");
    } else {
      tracked[product.id] = {
        productId: product.id,
        productName: product.name,
        currentPrice: product.price,
        targetPrice: targetPrice,
        createdAt: new Date().toISOString(),
      };
      showToast(
        "Price tracking enabled! We'll notify you when the price drops.",
        "success",
      );
    }

    localStorage.setItem("priceTracking", JSON.stringify(tracked));
    setTracking(!tracking);
  };

  return (
    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-start gap-3">
          <TrendingDown className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              Price Tracker
            </h4>
            <p className="text-xs text-gray-500">
              Get notified when this product's price drops
            </p>
          </div>
        </div>
        <button
          onClick={toggleTracking}
          className={`p-2 rounded-lg transition-all ${
            tracking
              ? "bg-black text-white hover:bg-gray-900"
              : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
          }`}
          aria-label={tracking ? "Stop tracking price" : "Track price"}
        >
          {tracking ? (
            <Bell className="w-4 h-4" />
          ) : (
            <BellOff className="w-4 h-4" />
          )}
        </button>
      </div>

      {tracking && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <label className="block text-xs font-medium text-gray-900 mb-2">
            Notify me when price drops below:
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">$</span>
            <input
              type="number"
              value={targetPrice.toFixed(2)}
              onChange={(e) => setTargetPrice(parseFloat(e.target.value) || 0)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              step="0.01"
              min="0"
            />
            <span className="text-xs text-gray-500">
              (Current: ${(product.price ?? 0).toFixed(2)})
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
