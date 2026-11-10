import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { useSession } from "@/features/auth/hooks/useSession"
import { QuackSyncBoundary } from "@/features/quack/components/QuackSyncBoundary"
import { QuackThread } from "@/features/quack/components/QuackThread"

export const Route = createFileRoute("/_ProtectedPages/quacks_/$id")({
  validateSearch: (search: Record<string, unknown>): { reply?: string; from?: string } => ({
    reply: typeof search.reply === "string" ? search.reply : undefined,
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  component: DiscussionPage,
})
function DiscussionPage() {
  const { user } = useSession()
  const { id } = Route.useParams()
  const { reply, from } = Route.useSearch()
  return (
    <QuackSyncBoundary>
      <Seo title="Discussion" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <QuackThread
          key={`${id}:${reply ?? ""}`}
          id={id}
          reply={reply}
          from={from}
          user={user ?? undefined}
        />
      </section>
    </QuackSyncBoundary>
  )
}
