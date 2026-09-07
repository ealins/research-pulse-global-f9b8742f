import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { hybridOpportunitiesQuery } from "@/lib/open-engine-radar";

export const Route = createFileRoute("/jobs")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hybridOpportunitiesQuery),
  component: JobsDataBoundary,
});

function JobsDataBoundary() {
  const rows = Route.useLoaderData();
  const queryClient = useQueryClient();

  if (queryClient.getQueryData(hybridOpportunitiesQuery.queryKey) === undefined) {
    queryClient.setQueryData(hybridOpportunitiesQuery.queryKey, rows);
  }

  return <Outlet />;
}
