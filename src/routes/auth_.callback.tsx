import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth_/callback")({
  head: () => ({
    meta: [
      { title: "Confirming sign-in — GeoAcademic Radar" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const finish = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (active) setError(exchangeError.message);
          return;
        }
      }
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (active) setError("The confirmation link is invalid or has expired.");
        return;
      }
      void navigate({ to: "/admin/pipeline-health", replace: true });
    };
    void finish();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Operations"
        title={error ? "Confirmation failed" : "Confirming your account…"}
        description={error ?? "Please wait while the secure sign-in is completed."}
      />
    </AppShell>
  );
}
