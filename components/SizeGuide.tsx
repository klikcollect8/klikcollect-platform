"use client";

import { useState } from "react";
import { Ruler, X } from "lucide-react";

interface SizeGuideProps {
  category: string;
}

export default function SizeGuide({ category }: SizeGuideProps) {
  const [isOpen, setIsOpen] = useState(false);

  const getSizeChart = () => {
    if (category === "Electronics") {
      return {
        title: "Device Size Guide",
        sizes: [
          {
            size: "Small",
            dimensions: "4-5 inches",
            description: "Compact devices",
          },
          {
            size: "Medium",
            dimensions: "5-6 inches",
            description: "Standard devices",
          },
          {
            size: "Large",
            dimensions: "6+ inches",
            description: "Large devices",
          },
        ],
      };
    }

    if (category === "Sports & Outdoors") {
      return {
        title: "Clothing Size Guide",
        sizes: [
          {
            size: "XS",
            dimensions: 'Chest: 32-34"',
            description: "Extra Small",
          },
          { size: "S", dimensions: 'Chest: 36-38"', description: "Small" },
          { size: "M", dimensions: 'Chest: 40-42"', description: "Medium" },
          { size: "L", dimensions: 'Chest: 44-46"', description: "Large" },
          {
            size: "XL",
            dimensions: 'Chest: 48-50"',
            description: "Extra Large",
          },
        ],
      };
    }

    return {
      title: "Size Guide",
      sizes: [
        {
          size: "One Size",
          dimensions: "Fits All",
          description: "Universal fit",
        },
      ],
    };
  };

  const chart = getSizeChart();

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 text-[13px] text-black/50 transition-colors hover:text-black"
      >
        <Ruler className="h-4 w-4" />
        Size Guide
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-auto bg-[#f7f7f5] pb-[env(safe-area-inset-bottom)] sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-black/[0.08] bg-[#f7f7f5] px-5 py-4 sm:px-6">
              <h2 className="flex items-center gap-2.5 text-[18px] font-medium tracking-tight sm:text-[20px]">
                <Ruler className="h-5 w-5 text-black/35" />
                {chart.title}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-11 w-11 items-center justify-center text-black/40 hover:text-black"
                aria-label="Close size guide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-5 sm:px-6 sm:py-6">
              <div className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:overflow-visible sm:px-0">
                <table className="w-full min-w-[480px] border border-black/[0.08] sm:min-w-0">
                  <thead>
                    <tr className="border-b border-black/[0.08] bg-black/[0.03]">
                      <th className="p-3 text-left text-[12px] font-medium uppercase tracking-[0.12em] text-black/50 sm:p-4">
                        Size
                      </th>
                      <th className="p-3 text-left text-[12px] font-medium uppercase tracking-[0.12em] text-black/50 sm:p-4">
                        Dimensions
                      </th>
                      <th className="p-3 text-left text-[12px] font-medium uppercase tracking-[0.12em] text-black/50 sm:p-4">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.sizes.map((item, idx) => (
                      <tr
                        key={item.size}
                        className={`border-b border-black/[0.06] last:border-b-0 ${
                          idx % 2 === 0 ? "bg-transparent" : "bg-black/[0.02]"
                        }`}
                      >
                        <td className="p-3 text-[14px] font-medium sm:p-4">
                          {item.size}
                        </td>
                        <td className="p-3 text-[14px] text-black/55 sm:p-4">
                          {item.dimensions}
                        </td>
                        <td className="p-3 text-[14px] text-black/55 sm:p-4">
                          {item.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-5 text-[13px] leading-relaxed text-black/45">
                <span className="font-medium text-black/70">Note:</span> Sizes
                may vary by manufacturer. Check the product description for
                specifics.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
