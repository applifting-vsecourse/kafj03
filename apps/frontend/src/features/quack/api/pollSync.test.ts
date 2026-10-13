import { QueryClient, QueryObserver } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { pollSync } from "./pollSync"
import { quackKeys } from "./quackKeys"
import type { Poll } from "./quackSchemas"

vi.mock("@/config/env", () => ({ env: { VITE_API_URL: "https://poll.test/api" } }))
class FakeEventSource extends EventTarget {
  static OPEN = 1
  readyState = 1
  onerror: (() => void) | null = null
  close = vi.fn()
  static instances: FakeEventSource[] = []
  constructor(
    public url: URL,
    public options: { withCredentials: boolean },
  ) {
    super()
    FakeEventSource.instances.push(this)
  }
  send(type: string, data: unknown = {}): void {
    this.dispatchEvent(new MessageEvent(type, { data: JSON.stringify(data) }))
  }
}
const initial: Poll = {
  id: "p",
  question: "Q",
  revision: 0,
  totalVotes: 0,
  myOptionId: null,
  options: [
    { id: "a", text: "A", position: 0, votes: 0, percentage: 0 },
    { id: "b", text: "B", position: 1, votes: 0, percentage: 0 },
  ],
}
const cleanup: (() => void)[] = []
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(quackKeys.poll("q"), initial)
  const fetch = vi.fn().mockResolvedValue(initial)
  const observer = new QueryObserver<Poll>(client, {
    queryKey: quackKeys.poll("q"),
    queryFn: fetch,
    staleTime: Infinity,
  })
  const stopObserver = observer.subscribe(() => undefined)
  const sync = pollSync(client)
  const stopSync = sync.subscribe(() => undefined)
  const source = FakeEventSource.instances[0]!
  cleanup.push(() => {
    stopSync()
    stopObserver()
    client.clear()
  })
  return { client, fetch, sync, source }
}

describe("poll synchronization", () => {
  beforeEach(() => {
    FakeEventSource.instances = []
    vi.stubGlobal("EventSource", FakeEventSource)
  })
  afterEach(() => {
    cleanup.splice(0).forEach((stop) => stop())
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("shares one authenticated stream and closes it after the last subscriber", () => {
    const { sync, source } = setup()
    const stop = sync.subscribe(() => undefined)
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(source.options.withCredentials).toBe(true)
    expect(source.url.pathname).toBe("/api/quacks/polls/events")
    stop()
    expect(source.close).not.toHaveBeenCalled()
    cleanup.splice(0).forEach((finish) => finish())
    expect(source.close).toHaveBeenCalledTimes(1)
  })

  it("reloads open polls on connection and reconnect before marking results current", async () => {
    const { sync, source, fetch } = setup()
    expect(sync.snapshot()).toBe("connecting")
    source.send("ready")
    await vi.waitFor(() => expect(sync.snapshot()).toBe("connected"))
    expect(fetch).toHaveBeenCalledTimes(1)
    source.onerror?.()
    expect(sync.snapshot()).toBe("disconnected")
    source.send("ready")
    await vi.waitFor(() => expect(sync.snapshot()).toBe("connected"))
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it("refreshes a changed poll within two seconds and ignores old or malformed events", async () => {
    const { client, source, fetch } = setup()
    const saved = { ...initial, revision: 1, totalVotes: 1 }
    fetch.mockResolvedValue(saved)
    const startedAt = performance.now()
    source.send("poll-changed", { quackId: "q", revision: 1 })
    await vi.waitFor(() => expect(client.getQueryData(quackKeys.poll("q"))).toEqual(saved), {
      timeout: 2000,
    })
    expect(performance.now() - startedAt).toBeLessThan(2000)
    source.send("poll-changed", { quackId: "q", revision: 0 })
    source.send("poll-changed", { quackId: "unopened", revision: 1 })
    source.send("poll-changed", { quackId: "q", revision: "bad" })
    source.dispatchEvent(new MessageEvent("poll-changed", { data: "bad JSON" }))
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("keeps results stale when reconnection refresh fails", async () => {
    const { source, fetch, sync } = setup()
    fetch.mockRejectedValue(new Error("Unavailable"))
    source.send("ready")
    await vi.waitFor(() => expect(sync.snapshot()).toBe("disconnected"))
  })

  it("detects a silent connection loss and replaces the stream", async () => {
    vi.useFakeTimers()
    const { sync, source } = setup()
    source.send("ready")
    await vi.advanceTimersByTimeAsync(0)
    expect(sync.snapshot()).toBe("connected")
    await vi.advanceTimersByTimeAsync(30_000)
    expect(sync.snapshot()).toBe("disconnected")
    expect(source.close).toHaveBeenCalled()
    expect(FakeEventSource.instances).toHaveLength(2)
  })
})
