"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { resolveProductImage } from "@/lib/product-image";

interface ImageGalleryProps {
  images: string[];
  productName: string;
}

export default function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const validImages = images
    .filter((img) => img && typeof img === "string" && img.trim() !== "")
    .map((img) => resolveProductImage(img));

  if (validImages.length === 0) {
    return (
      <div className="relative flex aspect-square w-full items-center justify-center bg-transparent">
        <span className="text-[13px] text-black/30">No image</span>
      </div>
    );
  }

  const nextImage = () => setCurrentIndex((prev) => (prev + 1) % validImages.length);
  const prevImage = () =>
    setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);

  return (
    <>
      <div className="relative w-full">
        <div
          className="relative mx-auto aspect-square w-full max-w-[640px] cursor-zoom-in"
          onClick={() => setIsFullscreen(true)}
          style={{
            WebkitMaskImage:
              "radial-gradient(ellipse 78% 78% at 50% 50%, #000 42%, transparent 82%)",
            maskImage:
              "radial-gradient(ellipse 78% 78% at 50% 50%, #000 42%, transparent 82%)",
          }}
        >
          <Image
            src={validImages[currentIndex]}
            alt={`${productName} — image ${currentIndex + 1}`}
            fill
            priority
            className="object-contain object-center"
            sizes="(max-width: 1024px) 90vw, 640px"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 72% 72% at 50% 50%, transparent 45%, rgba(247,247,245,0.5) 72%, #f7f7f5 100%)",
            }}
          />
        </div>

        {validImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={prevImage}
              className="absolute left-0 top-1/2 z-10 -translate-y-1/2 p-2 text-black/35 transition-colors hover:text-black"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className="absolute right-0 top-1/2 z-10 -translate-y-1/2 p-2 text-black/35 transition-colors hover:text-black"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={1.5} />
            </button>

            <div className="mt-6 flex justify-center gap-2">
              {validImages.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setCurrentIndex(index)}
                  aria-label={`Image ${index + 1}`}
                  className={`h-px transition-all duration-500 ${
                    index === currentIndex ? "w-8 bg-black" : "w-3 bg-black/20 hover:bg-black/40"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {isFullscreen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#f7f7f5]/90 backdrop-blur-xl"
          onClick={() => setIsFullscreen(false)}
        >
          <button
            type="button"
            onClick={() => setIsFullscreen(false)}
            className="absolute right-6 top-6 p-2 text-black/40 hover:text-black"
            aria-label="Close"
          >
            <X className="h-6 w-6" strokeWidth={1.5} />
          </button>
          <div className="relative h-[80vh] w-[80vw] max-w-4xl">
            <Image
              src={validImages[currentIndex]}
              alt={productName}
              fill
              className="object-contain"
              sizes="80vw"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
