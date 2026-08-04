"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type ThemeSelectOption = {
  value: string;
  label: string;
};

type ThemeSelectProps = {
  value: string;
  onValueChange: (value: string) => void;
  options: ThemeSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  size?: "sm" | "default";
  /** Stretch trigger to fill the parent (forms). Toolbar defaults stay compact. */
  fullWidth?: boolean;
  name?: string;
  disabled?: boolean;
  id?: string;
};

/**
 * Themed select - custom popup (not OS native), matches Obscura canvas.
 */
export default function ThemeSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select",
  className,
  triggerClassName,
  size = "default",
  fullWidth = false,
  name,
  disabled,
  id,
}: ThemeSelectProps) {
  const items = Object.fromEntries(options.map((o) => [o.value, o.label]));
  const selectedLabel =
    options.find((o) => o.value === value)?.label || placeholder;

  return (
    <Select
      value={value || null}
      onValueChange={(next) => {
        if (next == null) return;
        onValueChange(String(next));
      }}
      items={items}
      modal={false}
      name={name}
      disabled={disabled}
      id={id}
    >
      <SelectTrigger
        className={cn(
          "shrink-0 bg-transparent",
          fullWidth ? "w-full" : "w-auto",
          triggerClassName,
        )}
        size={size}
        aria-label={selectedLabel}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent
        align="start"
        sideOffset={6}
        className={cn("min-w-[12rem]", className)}
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
