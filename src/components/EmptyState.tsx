import { cn } from "@/lib/utils";

const TRUST_COPY =
  "Every record links back to an official source and carries a verification status. Nothing here is inferred.";

export function EmptyState({
  variant = "default",
  className,
}: {
  variant?: "default" | "compact" | "badge";
  className?: string;
}) {
  if (variant === "badge") {
    return (
      <span className={cn("mono-num text-[0.65rem] text-signal opacity-90", className)}>
        Sourcing now
      </span>
    );
  }

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <span className="text-xs font-medium text-signal">Sourcing now</span>
        <p className="text-[0.65rem] leading-snug text-muted-foreground">{TRUST_COPY}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="text-sm font-medium text-signal">Sourcing now</span>
      <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">{TRUST_COPY}</p>
    </div>
  );
}
