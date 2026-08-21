import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { runGlobalSearch, type SearchHit } from "@/lib/detail-queries";

const GROUP_LABEL: Record<string, string> = {
  institution: "Institutions",
  researcher: "Researchers",
  opportunity: "Positions",
  programme: "Programmes",
  project: "Projects",
  publication: "Publications",
  event: "Events",
  topic: "Topics",
};

function useDebounced(value: string, ms = 220) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebounced(q);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data, isFetching, error } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: () => runGlobalSearch(debounced),
    enabled: debounced.trim().length >= 2,
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SearchHit[]>();
    for (const hit of data ?? []) {
      const list = map.get(hit.entity_type) ?? [];
      list.push(hit);
      map.set(hit.entity_type, list);
    }
    return Array.from(map.entries());
  }, [data]);

  function go(hit: SearchHit) {
    setOpen(false);
    setQ("");
    switch (hit.entity_type) {
      case "institution":
        navigate({ to: "/institutions/$slug", params: { slug: hit.slug } });
        break;
      case "researcher":
        navigate({ to: "/researchers/$slug", params: { slug: hit.slug } });
        break;
      case "opportunity":
        navigate({ to: "/jobs/$slug", params: { slug: hit.slug } });
        break;
      case "topic":
        navigate({ to: "/topics/$slug", params: { slug: hit.slug } });
        break;
      case "programme":
        navigate({ to: "/programmes/$slug", params: { slug: hit.slug } });
        break;
      case "project":
        navigate({ to: "/projects/$slug", params: { slug: hit.slug } });
        break;
      case "publication":
        navigate({ to: "/publications/$id", params: { id: hit.slug } });
        break;
      case "event":
        navigate({ to: "/events/$slug", params: { slug: hit.slug } });
        break;
      default:
        break;
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
      >
        <Search className="h-3.5 w-3.5" />
        <span className="flex-1 truncate">Search everything…</span>
        <kbd className="mono-num hidden rounded border border-border px-1.5 py-0.5 text-[0.6rem] lg:inline">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          value={q}
          onValueChange={setQ}
          placeholder="Institutions, researchers, PhD positions, topics, projects…"
        />
        <CommandList>
          {debounced.trim().length < 2 ? (
            <CommandEmpty>Type at least two characters. Typos are tolerated.</CommandEmpty>
          ) : isFetching && !data ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : error ? (
            <CommandEmpty>Search is temporarily unavailable. Please try again.</CommandEmpty>
          ) : grouped.length === 0 ? (
            <CommandEmpty>
              Nothing recorded for that. We only show what a source backs up.
            </CommandEmpty>
          ) : (
            grouped.map(([type, hits]) => (
              <CommandGroup key={type} heading={GROUP_LABEL[type] ?? type}>
                {hits.map((hit) => (
                  <CommandItem
                    key={`${hit.entity_type}-${hit.entity_id}`}
                    value={`${hit.entity_id}`}
                    onSelect={() => go(hit)}
                    className="flex items-center gap-3"
                  >
                    <span className="truncate">{hit.title}</span>
                    {hit.subtitle ? (
                      <span className="ml-auto truncate text-[0.68rem] text-muted-foreground">
                        {hit.subtitle}
                      </span>
                    ) : null}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
