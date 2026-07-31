import Link from "next/link";
import Image from "next/image";
import { resolveProductImage } from "@/lib/product-image";

type Tile = {
  label: string;
  href: string;
  image?: string;
};

type HomeCardProps = {
  title: string;
  eyebrow?: string;
  href?: string;
  linkLabel?: string;
  image?: string;
  tiles?: Tile[];
  dark?: boolean;
  children?: React.ReactNode;
};

/** Apple-scale module card with marketplace discovery tiles */
export default function HomeCard({
  title,
  eyebrow,
  href,
  linkLabel = "See more",
  image,
  tiles,
  dark,
  children,
}: HomeCardProps) {
  return (
    <section
      className={`flex h-full flex-col overflow-hidden rounded-[var(--kc-radius)] p-5 shadow-[var(--kc-shadow)] ${
        dark ? "bg-[var(--kc-ink)] text-white" : "bg-[var(--kc-stage)] text-[var(--kc-ink)]"
      }`}
    >
      {eyebrow ? (
        <p
          className={`mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${
            dark ? "text-white/50" : "text-[var(--kc-faint)]"
          }`}
        >
          {eyebrow}
        </p>
      ) : null}
      <h2
        className="mb-4 text-[22px] font-semibold leading-tight tracking-tight"
        style={{ fontFamily: "var(--font-display), sans-serif" }}
      >
        {title}
      </h2>

      {tiles && tiles.length > 0 ? (
        <div className="grid flex-1 grid-cols-2 gap-3">
          {tiles.slice(0, 4).map((tile) => (
            <Link key={tile.href + tile.label} href={tile.href} className="group min-w-0">
              <div
                className={`relative aspect-square overflow-hidden rounded-[var(--kc-radius-sm)] ${
                  dark ? "bg-white/10" : "bg-[var(--kc-canvas)]"
                }`}
              >
                {tile.image ? (
                  <Image
                    src={resolveProductImage(tile.image)}
                    alt={tile.label}
                    fill
                    className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
                    sizes="160px"
                  />
                ) : null}
              </div>
              <p
                className={`mt-1.5 truncate text-[12px] ${
                  dark ? "text-white/80" : "text-[var(--kc-mute)]"
                }`}
              >
                {tile.label}
              </p>
            </Link>
          ))}
        </div>
      ) : null}

      {image && !tiles ? (
        <Link
          href={href || "/shop"}
          className={`relative mb-3 block min-h-[200px] flex-1 overflow-hidden rounded-[var(--kc-radius-sm)] ${
            dark ? "bg-white/10" : "bg-[var(--kc-canvas)]"
          }`}
        >
          <Image
            src={resolveProductImage(image)}
            alt={title}
            fill
            className="object-contain p-6"
            sizes="320px"
          />
        </Link>
      ) : null}

      {children}

      {href ? (
        <Link
          href={href}
          className={`mt-4 text-[14px] font-medium ${
            dark ? "text-[var(--kc-blue)] hover:underline" : "text-[var(--kc-link)] hover:underline"
          }`}
        >
          {linkLabel} →
        </Link>
      ) : null}
    </section>
  );
}
