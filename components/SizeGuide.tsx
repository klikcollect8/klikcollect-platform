'use client';

import { useState } from 'react';
import { Ruler, X } from 'lucide-react';

interface SizeGuideProps {
  category: string;
}

export default function SizeGuide({ category }: SizeGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getSizeChart = () => {
    if (category === 'Electronics') {
      return {
        title: 'Device Size Guide',
        sizes: [
          { size: 'Small', dimensions: '4-5 inches', description: 'Compact devices' },
          { size: 'Medium', dimensions: '5-6 inches', description: 'Standard devices' },
          { size: 'Large', dimensions: '6+ inches', description: 'Large devices' },
        ],
      };
    }

    if (category === 'Sports & Outdoors') {
      return {
        title: 'Clothing Size Guide',
        sizes: [
          { size: 'XS', dimensions: 'Chest: 32-34"', description: 'Extra Small' },
          { size: 'S', dimensions: 'Chest: 36-38"', description: 'Small' },
          { size: 'M', dimensions: 'Chest: 40-42"', description: 'Medium' },
          { size: 'L', dimensions: 'Chest: 44-46"', description: 'Large' },
          { size: 'XL', dimensions: 'Chest: 48-50"', description: 'Extra Large' },
        ],
      };
    }

    return {
      title: 'Size Guide',
      sizes: [
        { size: 'One Size', dimensions: 'Fits All', description: 'Universal fit' },
      ],
    };
  };

  const chart = getSizeChart();

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 text-sm text-gray-600 hover:text-black transition-colors"
      >
        <Ruler className="w-4 h-4" />
        Size Guide
      </button>

      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-auto shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-2xl font-light text-gray-900 flex items-center gap-3">
                <Ruler className="w-6 h-6 text-gray-400" />
                {chart.title}
              </h2>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close size guide"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6">
              <div className="overflow-hidden rounded-xl border border-gray-100">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="p-4 text-left text-sm font-medium text-gray-900">Size</th>
                      <th className="p-4 text-left text-sm font-medium text-gray-900">Dimensions</th>
                      <th className="p-4 text-left text-sm font-medium text-gray-900">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.sizes.map((item, idx) => (
                      <tr key={idx} className={`border-b border-gray-100 last:border-b-0 ${
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                      }`}>
                        <td className="p-4 font-medium text-gray-900">{item.size}</td>
                        <td className="p-4 text-gray-600">{item.dimensions}</td>
                        <td className="p-4 text-gray-600">{item.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-sm text-gray-600">
                  <strong className="font-medium text-gray-900">Note:</strong> Sizes may vary by manufacturer. Please refer to the product description for specific measurements.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
