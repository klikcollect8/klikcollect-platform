'use client';

import { useState, useEffect } from 'react';
import { Product } from '@/types';
import ProductCard from './ProductCard';
import { Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function PersonalizedRecommendations({ section }: { section?: { title?: string; subtitle?: string; productIds?: string[] } }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (section?.productIds && section.productIds.length > 0) {
          const selectedProducts = data.filter((p: Product) => 
            section.productIds!.includes(p.id)
          );
          setProducts(selectedProducts);
          setLoading(false);
        } else {
          // Simulate personalized recommendations based on browsing history
          const recentlyViewed = JSON.parse(localStorage.getItem('recentlyViewed') || '[]');
          let recommendations: Product[] = [];
          
          if (recentlyViewed.length > 0) {
            // Get products from same categories as recently viewed
            const viewedCategories = recentlyViewed.map((p: Product) => p.category);
            recommendations = data.filter((p: Product) => 
              viewedCategories.includes(p.category) && 
              !recentlyViewed.some((rv: Product) => rv.id === p.id)
            ).slice(0, 8);
          }
          
          // Fallback to best sellers if no recent views
          if (recommendations.length === 0) {
            recommendations = data
              .filter((p: Product) => (p.rating || 0) >= 4.5)
              .slice(0, 8);
          }
          
          setProducts(recommendations);
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  }, [section?.productIds]);

  if (loading || products.length === 0) return null;

  return (
    <div className="mb-8 md:mb-12">
      {/* Mobile: Simplified header */}
      <div className="md:hidden mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{section?.title || 'Recommended for You'}</h2>
        {section?.subtitle && (
          <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>
        )}
      </div>

      {/* Desktop: Full header with See more */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">{section?.title || 'Recommended for You'}</h2>
          {section?.subtitle && (
            <p className="text-gray-600 mt-1">{section.subtitle}</p>
          )}
        </div>
        <Link href="/" className="btn-outline text-sm flex items-center gap-2">
          See more <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Products */}
      <div className="overflow-x-auto scrollbar-hide -mx-4 px-4 md:-mx-6 md:px-6">
        <div className="flex gap-2 md:gap-4 pb-2 md:pb-4" style={{ width: 'max-content' }}>
          {products.map((product) => (
            <div key={product.id} className="shrink-0" style={{ width: 'calc(50vw - 20px)', maxWidth: '280px' }}>
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

