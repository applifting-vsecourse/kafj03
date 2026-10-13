import type { QueryClient } from "@tanstack/react-query"
import { z } from "zod"

import { env } from "@/config/env"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll } from "@/features/quack/api/quackSchemas"

const changeSchema = z.object({ quackId: z.string(), revision: z.number().int().nonnegative() })
type SyncStatus = "connecting" | "connected" | "disconnected"

class PollSync {
  private listeners = new Set<() => void>()
  private source?: EventSource
  private status: SyncStatus = "connecting"
  private lastMessageAt = 0
  private watchdog?: ReturnType<typeof setInterval>
  private generation = 0

  constructor(private readonly queryClient: QueryClient) {}

  snapshot = (): SyncStatus => this.status
  private setStatus(status: SyncStatus): void {
    if (status === this.status) return
    this.status = status
    this.listeners.forEach((listener) => listener())
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    if (this.listeners.size === 1) {
      this.connect()
      this.watchdog = setInterval(() => {
        if (Date.now() - this.lastMessageAt > 25_000) {
          this.source?.close()
          this.setStatus("disconnected")
          this.connect()
        }
      }, 5_000)
    }
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) {
        this.generation++
        this.source?.close()
        this.source = undefined
        clearInterval(this.watchdog)
        this.setStatus("connecting")
      }
    }
  }

  private connect(): void {
    const generation = ++this.generation
    this.lastMessageAt = Date.now()
    const url = new URL(`${env.VITE_API_URL.replace(/\/$/, "")}/quacks/polls/events`)
    const source = new EventSource(url, { withCredentials: true })
    this.source = source
    source.onerror = () => {
      this.setStatus("disconnected")
    }
    source.addEventListener("heartbeat", () => {
      this.lastMessageAt = Date.now()
    })
    source.addEventListener("ready", () => {
      this.lastMessageAt = Date.now()
      // Every reconnect reloads open polls: NOTIFY is intentionally not a replay log.
      void this.queryClient
        .refetchQueries({ queryKey: quackKeys.polls(), type: "active" }, { throwOnError: true })
        .then(() => {
          if (this.generation === generation && source.readyState === EventSource.OPEN) {
            this.setStatus("connected")
          }
        })
        .catch(() => {
          if (this.generation === generation) this.setStatus("disconnected")
        })
    })
    source.addEventListener("poll-changed", (event) => {
      this.lastMessageAt = Date.now()
      let data: unknown
      try {
        data = JSON.parse((event as MessageEvent<string>).data)
      } catch {
        return
      }
      const change = changeSchema.safeParse(data)
      if (!change.success) return
      const current = this.queryClient.getQueryData<Poll>(quackKeys.poll(change.data.quackId))
      if (!current || current.revision >= change.data.revision) return
      void this.queryClient.invalidateQueries({
        queryKey: quackKeys.poll(change.data.quackId),
        exact: true,
      })
    })
  }
}

const connections = new WeakMap<QueryClient, PollSync>()
export function pollSync(queryClient: QueryClient): PollSync {
  let connection = connections.get(queryClient)
  if (!connection) {
    connection = new PollSync(queryClient)
    connections.set(queryClient, connection)
  }
  return connection
}
