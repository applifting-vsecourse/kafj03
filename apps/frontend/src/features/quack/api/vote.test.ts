import { TimeoutError } from "ky"
import { afterEach, describe, expect, it, vi } from "vitest"

import { vote } from "./vote"

// Exercise ky's real timeout without making an external HTTP request.
vi.mock("@/lib/api-client", async () => {
  const { default: ky } = await import("ky")
  return {
    api: ky.create({
      prefix: "https://poll.test/api",
      retry: 0,
      fetch: () =>
        new Promise<Response>(() => {
          /* Intentionally never responds. */
        }),
    }),
  }
})

describe("vote request timeout", () => {
  afterEach(() => vi.useRealTimers())
  it("rejects a request with no response after ten seconds", async () => {
    vi.useFakeTimers()
    let hasSettled = false
    const request = vote("q", "a")
    const rejected = expect(request).rejects.toBeInstanceOf(TimeoutError)
    void request.then(
      () => {
        hasSettled = true
      },
      () => {
        hasSettled = true
      },
    )
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(9_999)
    expect(hasSettled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    await rejected
    expect(hasSettled).toBe(true)
  })
})
