import { useEffect, useSyncExternalStore, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { pollSync } from "@/features/quack/api/pollSync"

export function QuackSyncBoundary({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const sync = pollSync(client)
  const status = useSyncExternalStore(sync.subscribe, sync.snapshot, () => "connecting")
  useEffect(() => {
    const refresh = () => sync.revalidate()
    window.addEventListener("online", refresh)
    window.addEventListener("focus", refresh)
    return () => {
      window.removeEventListener("online", refresh)
      window.removeEventListener("focus", refresh)
    }
  }, [sync])
  return (
    <>
      {status !== "connected" ? (
        <p
          role="status"
          className="mx-auto max-w-2xl px-4 py-4 text-muted-foreground"
        >
          {status === "disconnected"
            ? "Synchronization lost. Reconnecting to verify current content…"
            : "Verifying current content…"}
        </p>
      ) : null}
      <div hidden={status !== "connected"}>{children}</div>
    </>
  )
}
