import { motion } from "framer-motion";

/** Shimmer pulse for skeleton elements */
const shimmer = {
  initial: { opacity: 0.4 },
  animate: { opacity: 0.8 },
  transition: {
    duration: 1.2,
    repeat: Infinity,
    repeatType: "reverse" as const,
    ease: "easeInOut" as const,
  },
};

/** A single skeleton block */
export const SkeletonBlock = ({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) => (
  <motion.div
    initial={shimmer.initial}
    animate={shimmer.animate}
    transition={shimmer.transition}
    className={`rounded-md bg-surface-2 ${className}`}
    style={style}
  />
);

/** Skeleton for a metric card (4-up grid) */
export const SkeletonMetricCard = () => (
  <div className="card-sig p-5">
    <div className="mb-3 flex items-center justify-between">
      <SkeletonBlock className="h-3 w-24" />
      <SkeletonBlock className="h-4 w-4 rounded-full" />
    </div>
    <SkeletonBlock className="h-7 w-20" />
    <SkeletonBlock className="mt-2 h-2.5 w-12" />
  </div>
);

/** Skeleton for a table row */
export const SkeletonTableRow = ({ cols = 6 }: { cols?: number }) => (
  <tr className="border-b border-border/50">
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <SkeletonBlock
          className={
            i === 0
              ? "h-4 w-16"
              : i === cols - 1
                ? "h-4 w-8 ml-auto"
                : "h-3 w-20"
          }
        />
      </td>
    ))}
  </tr>
);

/** Skeleton for a block feed item */
export const SkeletonBlockItem = () => (
  <div className="flex items-center gap-4 p-3">
    <SkeletonBlock className="h-9 w-9 rounded-md shrink-0" />
    <div className="flex-1 space-y-1.5">
      <SkeletonBlock className="h-3 w-48" />
      <SkeletonBlock className="h-2.5 w-32" />
    </div>
    <SkeletonBlock className="h-3 w-12" />
  </div>
);

/** Error banner shown when RPC connection fails */
export const ErrorBanner = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) => (
  <motion.div
    initial={{ opacity: 0, y: -8 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex items-center gap-3 rounded-lg border border-destructive/30 p-3"
    style={{ background: "hsl(5 80% 55% / 0.06)" }}
  >
    <span
      className="dot shrink-0"
      style={{
        background: "hsl(5 80% 55%)",
        boxShadow: "0 0 6px hsl(5 80% 55% / 0.40)",
      }}
    />
    <p className="flex-1 font-body text-xs leading-relaxed text-destructive">
      <span className="font-semibold">Error de conexión — </span>
      {message}
    </p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="shrink-0 rounded-md border border-destructive/30 px-2.5 py-1 font-mono text-[10px] font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        Reintentar
      </button>
    )}
  </motion.div>
);
