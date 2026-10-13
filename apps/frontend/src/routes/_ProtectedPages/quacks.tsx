import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { useSession } from "@/features/auth/hooks/useSession"
import { QuackFeed } from "@/features/quack/components/QuackFeed"
import { QuackForm } from "@/features/quack/components/QuackForm"

export const Route = createFileRoute("/_ProtectedPages/quacks")({
  component: QuacksPage,
})

function QuacksPage() {
  const { user } = useSession()
  return (
    <>
      <Seo title="Quacks" />
      <section className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight">Quacks</h1>

        <QuackForm
          className="mb-4"
          defaultMood={user?.defaultMood ?? ""}
        />

        <QuackFeed />
      </section>
    </>
  )
}
