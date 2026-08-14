import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://geoacademic.app";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const STATIC_ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "hourly", priority: "1.0" },
  { path: "/top", changefreq: "daily", priority: "0.9" },
  { path: "/atlas", changefreq: "daily", priority: "0.8" },
  { path: "/trends", changefreq: "daily", priority: "0.8" },
  { path: "/matcher", changefreq: "weekly", priority: "0.8" },
  { path: "/collaboration", changefreq: "weekly", priority: "0.6" },
  { path: "/methodology", changefreq: "monthly", priority: "0.6" },
  { path: "/jobs", changefreq: "hourly", priority: "0.9" },
  { path: "/institutions", changefreq: "daily", priority: "0.8" },
  { path: "/researchers", changefreq: "daily", priority: "0.7" },
  { path: "/programmes", changefreq: "weekly", priority: "0.8" },
  { path: "/events", changefreq: "daily", priority: "0.7" },
  { path: "/projects", changefreq: "weekly", priority: "0.7" },
  { path: "/publications", changefreq: "daily", priority: "0.7" },
  { path: "/topics", changefreq: "weekly", priority: "0.7" },
  { path: "/countries", changefreq: "weekly", priority: "0.7" },
];

function slugifyCountry(country: string): string {
  return country
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [...STATIC_ENTRIES];

        const url = import.meta.env["VITE_SUPABASE_URL"];
        const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

        if (url && key) {
          const supabase = createClient(url, key, {
            auth: { persistSession: false, autoRefreshToken: false },
          });

          const [
            institutions,
            researchers,
            opportunities,
            events,
            topics,
            courses,
            projects,
            publications,
          ] = await Promise.all([
            supabase.from("institutions").select("slug, country").eq("is_demo", false),
            supabase.from("researchers").select("slug").eq("is_demo", false),
            supabase.from("opportunities").select("slug").eq("is_demo", false),
            supabase.from("events").select("slug").eq("is_demo", false),
            supabase.from("research_topics").select("slug"),
            supabase.from("courses").select("slug").eq("is_demo", false),
            supabase.from("projects").select("slug").eq("is_demo", false),
            supabase.from("publications").select("id").eq("is_demo", false),
          ]);

          const push = (
            prefix: string,
            rows: { slug?: string | null }[] | null,
            priority: string,
            changefreq: NonNullable<SitemapEntry["changefreq"]>,
          ) => {
            for (const row of rows ?? []) {
              if (!row.slug) continue;
              entries.push({ path: `${prefix}/${row.slug}`, priority, changefreq });
            }
          };

          push("/institutions", institutions.data, "0.7", "weekly");
          push("/researchers", researchers.data, "0.6", "weekly");
          push("/jobs", opportunities.data, "0.8", "daily");
          push("/events", events.data, "0.6", "weekly");
          push("/topics", topics.data, "0.7", "weekly");
          push("/programmes", courses.data, "0.7", "weekly");
          push("/projects", projects.data, "0.6", "weekly");

          for (const row of publications.data ?? []) {
            entries.push({
              path: `/publications/${row.id}`,
              priority: "0.5",
              changefreq: "monthly",
            });
          }

          const countries = new Set(
            (institutions.data ?? [])
              .map((row) => row.country)
              .filter((c): c is string => Boolean(c))
              .map(slugifyCountry),
          );
          for (const country of countries) {
            entries.push({ path: `/countries/${country}`, priority: "0.6", changefreq: "weekly" });
          }
        }

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
