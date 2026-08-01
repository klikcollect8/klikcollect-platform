"use client";

import {
  Bag,
  House,
  List,
  MagnifyingGlass,
  Storefront,
  User,
  X,
  type Icon,
  type IconProps,
  type IconWeight,
} from "@phosphor-icons/react";

/** Shared chrome icons — Phosphor, light outline / fill when active. */
export const NAV_ICON_SIZE = 22;

type NavIconProps = {
  active?: boolean;
  className?: string;
  size?: number;
};

function weight(active?: boolean): IconWeight {
  return active ? "fill" : "regular";
}

function NavGlyph({
  icon: Glyph,
  active,
  className,
  size = NAV_ICON_SIZE,
}: NavIconProps & { icon: Icon }) {
  const props: IconProps = {
    size,
    weight: weight(active),
    className,
    "aria-hidden": true,
  };
  return <Glyph {...props} />;
}

export function HomeIcon(props: NavIconProps) {
  return <NavGlyph icon={House} {...props} />;
}

export function SearchIcon(props: NavIconProps) {
  return <NavGlyph icon={MagnifyingGlass} {...props} />;
}

export function VendorsIcon(props: NavIconProps) {
  return <NavGlyph icon={Storefront} {...props} />;
}

export function BagIcon(props: NavIconProps) {
  return <NavGlyph icon={Bag} {...props} />;
}

export function AccountIcon(props: NavIconProps) {
  return <NavGlyph icon={User} {...props} />;
}

export function MenuIcon(props: NavIconProps) {
  return <NavGlyph icon={List} {...props} />;
}

export function CloseIcon(props: NavIconProps) {
  return <NavGlyph icon={X} {...props} />;
}
