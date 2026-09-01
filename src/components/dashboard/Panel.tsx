import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface PanelProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  delay?: number;
  accent?: boolean;
}

export const Panel = ({
  title,
  description,
  children,
  className = "",
  delay = 0,
  accent = false,
}: PanelProps) => {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className={`panel ${accent ? "accent-bar" : ""} relative overflow-hidden p-6 ${className}`}
    >
      <div className="relative">
        <div className="mb-5">
          <span className="label">{title}</span>
          {description && (
            <p className="mt-2.5 font-body text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </motion.section>
  );
};

interface StatCardProps {
  label: string;
  value: string;
  unit?: string;
  icon?: ReactNode;
  accent?: "primary" | "accent" | "neutral";
  delay?: number;
}

export const StatCard = ({
  label,
  value,
  unit,
  icon,
  accent = "neutral",
  delay = 0,
}: StatCardProps) => {
  const color =
    accent === "primary"
      ? "var(--primary)"
      : accent === "accent"
        ? "var(--accent)"
        : "var(--foreground)";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay }}
      className="card-sig relative overflow-hidden p-5"
    >
      <div
        className="absolute right-0 top-0 h-16 w-16 rounded-full opacity-[0.04] blur-2xl"
        style={{ background: color }}
      />
      <div className="relative">
        <div className="mb-3 flex items-center justify-between">
          <p className="label-muted">{label}</p>
          {icon && <span className="text-muted-foreground/40">{icon}</span>}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-display text-2xl font-bold tracking-tight"
            style={{ color }}
          >
            {value}
          </span>
          {unit && (
            <span className="font-body text-xs text-muted-foreground">
              {unit}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
};
