"use client";

type DriverPageHeaderProps = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

export default function DriverPageHeader({
  eyebrow,
  title,
  subtitle,
}: DriverPageHeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-[28px] bg-[#111] px-5 py-6 text-white">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/[0.06]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-emerald-400/10"
        aria-hidden
      />
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/45">
        {eyebrow}
      </p>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-[28ch] text-[14px] leading-relaxed text-white/55">
          {subtitle}
        </p>
      ) : null}
    </header>
  );
}
