'use client';

import { useEffect, useState } from 'react';
import { Product } from '@/types';
import ProductCard from './ProductCard';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Star, Clock } from 'lucide-react';

export function BestSellers({ section }: { section?: { title?: string; subtitle?: string; productIds?: string[] } }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (section?.productIds && section.productIds.length > 0) {
          const selectedProducts = data.filter((p: Product) => 
            section.productIds!.includes(p.id)
          );
          setProducts(selectedProducts);
        } else {
          const bestSellers = data
            .filter((p: Product) => p.badges?.includes('Best Seller'))
            .slice(0, 8);
          setProducts(bestSellers);
        }
      });
  }, [section?.productIds]);

  if (products.length === 0) return null;

  return (
    <div className="mb-8 md:mb-12">
      {/* Mobile: Simplified header */}
      <div className="md:hidden mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{section?.title || 'Best Sellers'}</h2>
        {section?.subtitle && (
          <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>
        )}
      </div>

      {/* Desktop: Full header with See more */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">{section?.title || 'Best Sellers'}</h2>
          {section?.subtitle && (
            <p className="text-gray-600 mt-1">{section.subtitle}</p>
          )}
        </div>
        <Link href="/shop" className="btn-outline text-sm flex items-center gap-2">
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

export function TopRated({ section }: { section?: { title?: string; subtitle?: string; productIds?: string[] } }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (section?.productIds && section.productIds.length > 0) {
          const selectedProducts = data.filter((p: Product) => 
            section.productIds!.includes(p.id)
          );
          setProducts(selectedProducts);
        } else {
          const topRated = [...data]
            .filter((p: Product) => (p.rating || 0) >= 4.5)
            .sort((a, b) => (b.rating || 0) - (a.rating || 0))
            .slice(0, 8);
          setProducts(topRated);
        }
      });
  }, [section?.productIds]);

  if (products.length === 0) return null;

  return (
    <div className="mb-8 md:mb-12">
      {/* Mobile: Simplified header */}
      <div className="md:hidden mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{section?.title || 'Top Rated Products'}</h2>
        {section?.subtitle && (
          <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>
        )}
      </div>

      {/* Desktop: Full header with See more */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">{section?.title || 'Top Rated Products'}</h2>
          {section?.subtitle && (
            <p className="text-gray-600 mt-1">{section.subtitle}</p>
          )}
        </div>
        <Link href="/?sort=rating" className="btn-outline text-sm flex items-center gap-2">
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

export function NewArrivals({ section }: { section?: { title?: string; subtitle?: string; productIds?: string[] } }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        if (section?.productIds && section.productIds.length > 0) {
          const selectedProducts = data.filter((p: Product) => 
            section.productIds!.includes(p.id)
          );
          setProducts(selectedProducts);
        } else {
          const newArrivals = [...data]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 8);
          setProducts(newArrivals);
        }
      });
  }, [section?.productIds]);

  if (products.length === 0) return null;

  return (
    <div className="mb-8 md:mb-12">
      {/* Mobile: Simplified header */}
      <div className="md:hidden mb-4">
        <h2 className="text-lg font-semibold text-gray-900">{section?.title || 'New Arrivals'}</h2>
        {section?.subtitle && (
          <p className="text-sm text-gray-600 mt-1">{section.subtitle}</p>
        )}
      </div>

      {/* Desktop: Full header with See more */}
      <div className="hidden md:flex items-center justify-between mb-6">
        <div>
          <h2 className="section-title">{section?.title || 'New Arrivals'}</h2>
          {section?.subtitle && (
            <p className="text-gray-600 mt-1">{section.subtitle}</p>
          )}
        </div>
        <Link href="/?sort=newest" className="btn-outline text-sm flex items-center gap-2">
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

