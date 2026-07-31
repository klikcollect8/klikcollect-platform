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
    <div className="min-h-screen w-full bg-[#f7f7f5] text-black">
      <div className="grid min-h-screen w-full grid-cols-1 lg:grid-cols-12">
        {/* Left — full-page blended carousel */}
        <div className="relative lg:col-span-7 xl:col-span-7">
          <AuthCarousel />
        </div>

        {/* Right — seamless auth panel */}
        <div className="relative z-20 flex flex-col lg:col-span-5 xl:col-span-5">
          <header className="flex items-center justify-between px-6 pt-6 sm:px-10 lg:px-12 lg:pt-10 xl:px-16">
            <Link
              href="/"
              className="text-[15px] font-medium uppercase tracking-[0.14em] text-black lg:invisible"
            >
              KLIKCOLLECT®
            </Link>
            <Link
              href="/"
              className="text-[13px] text-black/40 underline underline-offset-4 decoration-black/15 transition-colors hover:text-black hover:decoration-black"
            >
              Back to shop
            </Link>
          </header>

          <div className="flex flex-1 flex-col justify-center px-6 py-12 sm:px-10 lg:px-12 lg:py-16 xl:px-16">
            <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-[clamp(1.75rem,3vw,2.35rem)] font-medium tracking-tight">
              {title}
            </h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-black/45">
              {description}
            </p>

            {notice ? (
              <p className="mt-6 max-w-sm border-l border-black/15 pl-4 text-[14px] leading-relaxed text-black/50">
                {notice}
              </p>
            ) : null}

            <div className="mt-8 w-full max-w-md">{children}</div>

            <p className="mt-8 text-[14px] text-black/40">
              {alternateLabel}{" "}
              <Link
                href={alternateHref}
                className="font-medium text-black underline underline-offset-4 decoration-black/15 hover:decoration-black"
              >
                {alternateCta}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
