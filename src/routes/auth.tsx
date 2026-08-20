import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Operations sign-in — GeoAcademic Radar" },
      {
        name: "description",
        content:
          "Sign in to reach the GeoAcademic Radar operations area. Public research pages need no account; only pipeline diagnostics require an admin session.",
      },
      { property: "og:title", content: "Operations sign-in — GeoAcademic Radar" },
      { property: "og:description", content: "Sign in to reach GeoAcademic Radar pipeline operations." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const redirectTo = () => window.location.origin + "/auth/callback";

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) void navigate({ to: "/admin/pipeline-health", replace: true });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo() },
        });
        if (error) throw error;
        if (!data.session) {
          setSent(true);
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(mode === "signup" ? "Sign-up failed" : "Sign-in failed", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      toast.success("Confirmation email sent again");
    } catch (err) {
      toast.error("Could not resend confirmation", {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title="Sign in"
        description="Public research pages stay open to everyone. An account is only needed for the pipeline operations area, and diagnostics additionally require the admin role."
      />
      <div className="mx-auto w-full max-w-md px-6 py-10">
        {sent ? (
          <div className="space-y-3 rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
            <p>Check your inbox and confirm the address. The confirmation link will return you securely to the operations area.</p>
            <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={resend}>
              {busy ? "Sending…" : "Resend confirmation email"}
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 rounded-xl border border-border/60 bg-card/40 p-5">
            <div>
              <label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </div>
            <div>
              <label htmlFor="password" className="text-xs uppercase tracking-wide text-muted-foreground">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              <Lock className="mr-1.5 h-3.5 w-3.5" />
              {busy ? "Working…" : mode === "signup" ? "Create account" : "Sign in"}
            </Button>
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="w-full text-xs text-muted-foreground underline-offset-4 hover:text-primary hover:underline"
            >
              {mode === "signup" ? "I already have an account" : "Create an operations account"}
            </button>
          </form>
        )}
      </div>
    </AppShell>
  );
}
