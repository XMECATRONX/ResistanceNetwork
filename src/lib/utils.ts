import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converts a color to an HSL string with alpha.
 * Supports both `var(--token)` references and direct `hsl(...)` strings.
 * Examples:
 *   alpha("var(--primary)", 0.10) → "hsl(var(--primary) / 0.10)"
 *   alpha("hsl(150 100% 45%)", 0.10) → "hsl(150 100% 45% / 0.10)"
 */
export function alpha(color: string, opacity: number): string {
  if (color.startsWith("var(")) {
    const token = color.replace("var(", "").replace(")", "");
    return `hsl(${token} / ${opacity})`;
  }
  // Direct hsl() string: "hsl(150 100% 45%)" → "hsl(150 100% 45% / 0.10)"
  if (color.startsWith("hsl(")) {
    return color.replace("hsl(", "hsl(").replace(")", ` / ${opacity})`);
  }
  // Fallback: assume hex or other
  return color;
}
