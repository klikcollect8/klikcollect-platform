"use client";

export default function AdminFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-neutral-200 bg-white mt-auto">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 lg:gap-6">
          <p className="text-sm text-neutral-500">
            © {currentYear} KlikCollect Admin. All rights reserved.
          </p>
          <div className="flex items-center gap-4 lg:gap-6 text-sm text-neutral-500">
            <span className="text-neutral-400">Admin Panel</span>
            <span className="text-neutral-300">•</span>
            <a
              href="/"
              className="text-black hover:text-neutral-600 font-medium transition-colors"
            >
              View Store
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
