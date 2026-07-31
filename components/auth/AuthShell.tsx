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
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-6 py-8 sm:px-10 lg:px-14 xl:px-20">
        <header className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[16px] font-medium uppercase tracking-[0.14em] text-black"
          >
            KLIKCOLLECT®
          </Link>
          <Link
            href="/"
            className="text-[13px] text-black/45 underline underline-offset-4 decoration-black/15 transition-colors hover:text-black hover:decoration-black"
          >
            Back to shop
          </Link>
        </header>

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-16 sm:py-20">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-black/35">
            {eyebrow}
          </p>
          <h1 className="mt-4 text-[clamp(1.75rem,4vw,2.5rem)] font-medium tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-black/50">
            {description}
          </p>

          {notice ? (
            <p className="mt-6 border-l border-black/20 pl-4 text-[14px] leading-relaxed text-black/55">
              {notice}
            </p>
          ) : null}

          <div className="mt-10 border-t border-black/[0.06] pt-10">{children}</div>

          <p className="mt-10 text-[14px] text-black/45">
            {alternateLabel}{" "}
            <Link
              href={alternateHref}
              className="font-medium text-black underline underline-offset-4 decoration-black/20 hover:decoration-black"
            >
              {alternateCta}
            </Link>
          </p>
        </main>
      </div>
    </div>
  );
}
