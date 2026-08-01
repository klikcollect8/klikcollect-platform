/** Custom bottom-nav icons — outline idle, solid when active. */

type IconProps = {
  active?: boolean;
  className?: string;
};

const base = "h-[22px] w-[22px] shrink-0";

function Svg({
  active,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 0 : 1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? base}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function HomeIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden fill="currentColor">
        <path d="M12 3.2 3.8 10.2c-.3.25-.45.6-.4.95V20a1.2 1.2 0 0 0 1.2 1.2h4.4V14.8h5.6V21.2h4.4A1.2 1.2 0 0 0 20.2 20v-8.85c.05-.35-.1-.7-.4-.95L12 3.2Z" />
      </svg>
    );
  }
  return (
    <Svg active={false} className={className}>
      <path d="M4.5 10.5 12 4l7.5 6.5V20a1 1 0 0 1-1 1h-4.25v-5.5h-4.5V21H5.5a1 1 0 0 1-1-1v-9.5Z" />
    </Svg>
  );
}

export function SearchIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden fill="currentColor">
        <path d="M10.5 3.5a7 7 0 1 0 4.35 12.48l3.84 3.84a1 1 0 0 0 1.41-1.41l-3.84-3.84A7 7 0 0 0 10.5 3.5Zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z" />
      </svg>
    );
  }
  return (
    <Svg active={false} className={className}>
      <circle cx="10.5" cy="10.5" r="6.25" />
      <path d="m15.4 15.4 4.1 4.1" />
    </Svg>
  );
}

/** Storefront — awning + door, reads as “vendors” better than a generic shop. */
export function VendorsIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden fill="currentColor">
        <path d="M3.5 9.2 5 4.8h14l1.5 4.4c.2.55-.2 1.1-.8 1.1H4.3c-.6 0-1-.55-.8-1.1ZM5 11.5h14V20a1 1 0 0 1-1 1h-3.2v-5.2H9.2V21H6a1 1 0 0 1-1-1v-8.5Z" />
      </svg>
    );
  }
  return (
    <Svg active={false} className={className}>
      <path d="M4 9.5 5.4 5h13.2L20 9.5H4Z" />
      <path d="M5 9.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
      <path d="M9.5 20v-5.25h5V20" />
      <path d="M8 9.5v1.35M12 9.5v1.35M16 9.5v1.35" />
    </Svg>
  );
}

export function BagIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden fill="currentColor">
        <path d="M8.2 8V7.2a3.8 3.8 0 0 1 7.6 0V8h2.3A1.5 1.5 0 0 1 19.6 9.6l-.7 9.2A1.9 1.9 0 0 1 17 20.6H7a1.9 1.9 0 0 1-1.9-1.8l-.7-9.2A1.5 1.5 0 0 1 5.9 8h2.3Zm1.7 0h4.2V7.2a2.1 2.1 0 0 0-4.2 0V8Z" />
      </svg>
    );
  }
  return (
    <Svg active={false} className={className}>
      <path d="M6.2 9h11.6l-.75 9.4A1.5 1.5 0 0 1 15.56 20H8.44a1.5 1.5 0 0 1-1.49-1.6L6.2 9Z" />
      <path d="M9 9V7.4a3 3 0 0 1 6 0V9" />
    </Svg>
  );
}

export function AccountIcon({ active, className }: IconProps) {
  if (active) {
    return (
      <svg viewBox="0 0 24 24" className={className ?? base} aria-hidden fill="currentColor">
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5.2 19.4c.7-3.2 3.4-5.2 6.8-5.2s6.1 2 6.8 5.2c.1.45-.25.85-.7.85H5.9c-.45 0-.8-.4-.7-.85Z" />
      </svg>
    );
  }
  return (
    <Svg active={false} className={className}>
      <circle cx="12" cy="8" r="3.25" />
      <path d="M5.5 19.2c.75-3.1 3.25-4.9 6.5-4.9s5.75 1.8 6.5 4.9" />
    </Svg>
  );
}
