import { createFileRoute } from "@tanstack/react-router"

import { Seo } from "@/components/Seo"

import { SettingsForm } from "@/features/auth/components/SettingsForm"
import { useSession } from "@/features/auth/hooks/useSession"

export const Route = createFileRoute("/_ProtectedPages/settings")({ component: SettingsPage })

function SettingsPage() {
  const { user } = useSession()
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-8">
      <Seo title="Settings" />
      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>
      {user ? <SettingsForm user={user} /> : null}
    </section>
  )
}
