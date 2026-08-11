import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";

export type CategoryTab = { key: string; label: string; count?: number };

export function CategoryTabs({
  tabs,
  active,
  onSelect,
  className,
}: {
  tabs: CategoryTab[];
  active: string;
  onSelect: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-pressed={active === t.key}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
            active === t.key
              ? "border-primary/50 bg-primary/15 text-primary"
              : "border-border bg-card/60 text-muted-foreground hover:border-primary/30 hover:text-foreground",
          )}
        >
          <span>{t.label}</span>
          {typeof t.count === "number" ? (
            t.count === 0 ? (
              <EmptyState variant="badge" />
            ) : (
              <span className="mono-num text-[0.65rem] opacity-70">{t.count}</span>
            )
          ) : null}
        </button>
      ))}
    </div>
  );
}
