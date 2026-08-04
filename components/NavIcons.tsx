"use client";

import {
  BagSimple,
  BellSimple,
  Compass,
  HouseSimple,
  List,
  MagnifyingGlass,
  Package,
  User,
  X,
  type Icon,
  type IconProps,
  type IconWeight,
} from "@phosphor-icons/react";

/** Shared chrome icons - thin SF-style outlines, fill when active. */
export const NAV_ICON_SIZE = 24;

type NavIconProps = {
  active?: boolean;
  className?: string;
  size?: number;
};

function weight(active?: boolean): IconWeight {
  return active ? "fill" : "light";
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
  return <NavGlyph icon={HouseSimple} {...props} />;
}

export function SearchIcon(props: NavIconProps) {
  return <NavGlyph icon={MagnifyingGlass} {...props} />;
}

export function ExploreIcon(props: NavIconProps) {
  return <NavGlyph icon={Compass} {...props} />;
}

export function OrdersIcon(props: NavIconProps) {
  return <NavGlyph icon={Package} {...props} />;
}

export function BagIcon(props: NavIconProps) {
  return <NavGlyph icon={BagSimple} {...props} />;
}

export function AccountIcon(props: NavIconProps) {
  return <NavGlyph icon={User} {...props} />;
}

export function BellIcon(props: NavIconProps) {
  return <NavGlyph icon={BellSimple} {...props} />;
}

export function MenuIcon(props: NavIconProps) {
  return <NavGlyph icon={List} {...props} />;
}

export function CloseIcon(props: NavIconProps) {
  return <NavGlyph icon={X} {...props} />;
}
