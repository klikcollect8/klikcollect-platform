import Image from "next/image";
import Link from "next/link";

type AuthShellProps = {
  eyebrow: string;
  title: string;
  description: string;
  notice?: string | null;
  children: React.ReactNode;
  alternateHref: string;
  alternateLabel: string;
  alternateCta: string;
  /** Large left-stage headline */
  stageTitle: string;
  /** Supporting line under stage title */
  stageBody: string;
};

function ClerkMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2.5 3.5 7v10L12 21.5 20.5 17V7L12 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M12 8.2v7.6M8.4 10.1l7.2 3.8M15.6 10.1l-7.2 3.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function AuthShell({
  eyebrow,
  title,
  description,
  notice,
  children,
  alternateHref,
  alternateLabel,
  alternateCta,
  stageTitle,
  stageBody,
}: AuthShellProps) {
  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[#f7f7f5] text-black">
      {/* Full-bleed pavilion — one visual plane */}
      <div className="pointer-events-none absolute inset-0">
        <Image
          src="/auth/marketplace-pavilion.jpg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        {/* Light wash — pavilion stays visible; right side softens for the form */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(100deg, rgba(247,247,245,0.55) 0%, rgba(247,247,245,0.28) 34%, rgba(247,247,245,0.55) 58%, rgba(247,247,245,0.92) 100%)",
          }}
        />
        <div
          className="absolute inset-y-0 right-0 w-[48%]"
          style={{
            background:
              "linear-gradient(to left, rgba(247,247,245,0.96) 0%, rgba(247,247,245,0.82) 45%, transparent 100%)",
          }}
        />
      </div>

      <div className="relative z-10 grid min-h-[100svh] w-full grid-cols-1 lg:grid-cols-12">
        {/* Left stage — large copy, vertically centered, left-aligned */}
        <aside className="relative flex min-h-[44svh] flex-col px-6 py-6 sm:px-10 lg:col-span-7 lg:min-h-[100svh] lg:px-14 lg:py-10 xl:pl-20 xl:pr-10">
          <Link
            href="/"
            className="w-fit text-[13px] font-medium uppercase tracking-[0.18em] text-black transition-opacity hover:opacity-50"
          >
            KLIKCOLLECT®
          </Link>

          <div className="flex flex-1 items-center py-10 lg:py-0">
            <div className="w-full max-w-[36rem] text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-black/45">
                Nairobi · Click &amp; collect · KES
              </p>

              <h2 className="mt-5 text-[clamp(2.55rem,5vw,4.1rem)] font-medium leading-[1.02] tracking-tight text-black">
                {stageTitle}
              </h2>

              <p className="mt-6 max-w-[36ch] text-[17px] leading-[1.55] text-black/55 sm:text-[19px]">
                {stageBody}
              </p>

              <ul className="mt-9 flex flex-col gap-3.5 text-[13px] text-black/50 sm:text-[14px]">
                <li className="flex items-center gap-3">
                  <span className="h-px w-5 shrink-0 bg-black/30" />
                  Real vendors. Real shelves. Ready when you are.
                </li>
                <li className="flex items-center gap-3">
                  <span className="h-px w-5 shrink-0 bg-black/30" />
                  Save picks, track orders, skip the queue.
                </li>
              </ul>
            </div>
          </div>

          <p className="hidden text-[12px] text-black/35 lg:block">
            Groceries &amp; everyday essentials — built for Nairobi.
          </p>
        </aside>

        {/* Right — auth panel, vertically centered, seamless into canvas */}
        <section className="relative flex min-h-0 flex-col lg:col-span-5">
          <header className="flex shrink-0 items-center justify-end px-6 pt-5 sm:px-10 lg:px-12 lg:pt-10 xl:px-16">
            <Link
              href="/"
              className="text-[13px] text-black/40 transition-colors hover:text-black"
            >
              ← Back to shop
            </Link>
          </header>

          <div className="flex flex-1 flex-col justify-center px-6 pb-12 pt-4 sm:px-10 lg:px-12 lg:pb-16 lg:pt-0 xl:px-16">
            <div className="mx-auto w-full max-w-[360px] lg:mx-0 lg:ml-auto lg:mr-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
                {eyebrow}
              </p>

              <h1 className="mt-3 text-[clamp(2rem,3vw,2.5rem)] font-medium leading-none tracking-tight">
                {title}
              </h1>

              <p className="mt-3.5 max-w-[32ch] text-[15px] leading-[1.5] text-black/45">
                {description}
              </p>

              {notice ? (
                <p className="mt-5 border-l border-black/15 pl-3 text-[13px] leading-relaxed text-black/50">
                  {notice}
                </p>
              ) : null}

              <div className="mt-8">{children}</div>

              <p className="mt-7 text-[13px] leading-relaxed text-black/40">
                {alternateLabel}{" "}
                <Link
                  href={alternateHref}
                  className="text-black underline underline-offset-[5px] decoration-black/25 transition-colors hover:decoration-black"
                >
                  {alternateCta}
                </Link>
              </p>

              <div className="mt-10 flex items-center gap-2.5 border-t border-black/[0.06] pt-6">
                <ClerkMark className="h-4 w-4 text-black/35" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-black/45">
                    Secured by Clerk
                  </p>
                  <p className="text-[12px] leading-snug text-black/30">
                    Bank-grade auth · encrypted sessions · no passwords shared with us
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
