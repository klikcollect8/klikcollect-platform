import Link from "next/link";
import AuthCarousel from "@/components/auth/AuthCarousel";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  notice?: string | null;
  children: React.ReactNode;
  alternateHref: string;
  alternateLabel: string;
  alternateCta: string;
};

export default function AuthShell({
  eyebrow,
  title,
  description,
  notice,
  children,
  alternateHref,
  alternateLabel,
  alternateCta,
}: AuthShellProps) {
  return (
    <div className="min-h-[100svh] w-full overflow-hidden bg-[#f7f7f5] text-black">
      <div className="grid min-h-[100svh] w-full grid-cols-1 lg:grid-cols-12">
        {/* Atmosphere — image-led left stage */}
        <aside className="relative lg:col-span-7">
          <AuthCarousel />
        </aside>

        {/* Form column */}
        <section className="relative z-20 flex min-h-0 flex-col bg-[#f7f7f5] lg:col-span-5">
          <header className="flex shrink-0 items-center justify-end px-6 pt-5 sm:px-10 lg:px-12 lg:pt-8 xl:px-16">
            <Link
              href="/"
              className="text-[13px] text-black/35 transition-colors hover:text-black"
            >
              ← Shop
            </Link>
          </header>

          <div className="flex flex-1 flex-col justify-start px-6 pb-12 pt-2 sm:px-10 lg:px-12 lg:pb-14 lg:pt-4 xl:px-16">
            <div className="mx-auto w-full max-w-[340px]">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
                {eyebrow}
              </p>

              <h1 className="mt-3 text-[clamp(2rem,3.2vw,2.55rem)] font-medium leading-none tracking-tight">
                {title}
              </h1>

              <p className="mt-3 max-w-[28ch] text-[15px] leading-[1.5] text-black/45">
                {description}
              </p>

              {notice ? (
                <p className="mt-5 border-l border-black/15 pl-3 text-[13px] leading-relaxed text-black/50">
                  {notice}
                </p>
              ) : null}

              <div className="mt-7">{children}</div>

              <p className="mt-7 text-[13px] leading-relaxed text-black/40">
                {alternateLabel}{" "}
                <Link
                  href={alternateHref}
                  className="text-black underline underline-offset-[5px] decoration-black/25 transition-colors hover:decoration-black"
                >
                  {alternateCta}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
