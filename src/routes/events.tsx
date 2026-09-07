import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Outlet } from "@tanstack/react-router";

import { hybridEventsQuery } from "@/lib/open-engine-radar";

export const Route = createFileRoute("/events")({
  loader: ({ context }) => context.queryClient.ensureQueryData(hybridEventsQuery),
  component: EventsDataBoundary,
});

function EventsDataBoundary() {
  const rows = Route.useLoaderData();
  const queryClient = useQueryClient();

  if (queryClient.getQueryData(hybridEventsQuery.queryKey) === undefined) {
    queryClient.setQueryData(hybridEventsQuery.queryKey, rows);
  }

  return <Outlet />;
}
