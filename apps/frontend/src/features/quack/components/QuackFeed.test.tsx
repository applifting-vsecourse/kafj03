import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuackFeed } from "./QuackFeed"

const get = vi.hoisted(() => vi.fn())
const usage = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api-client", () => ({ api: { get } }))
vi.mock("@/features/quack/api/searchUsage", () => ({ recordSearchUsage: usage }))
const post = {
  id: "q1",
  text: "Žlutý výlet",
  userId: "u1",
  createdAt: "2026-01-01T00:00:00Z",
  user: { id: "u1", name: "Petr", username: "petr" },
}
const mount = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <QuackFeed />
    </QueryClientProvider>,
  )

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("QuackFeed", () => {
  it("debounces queries, records completed search without its text, opens results, and restores the feed", async () => {
    get.mockImplementation(() => ({ json: () => Promise.resolve([post]) }))
    mount()
    await screen.findByText("Žlutý výlet")
    expect(usage).toHaveBeenCalledWith("feed")
    vi.useFakeTimers()
    fireEvent.change(screen.getByLabelText("Search posts"), { target: { value: "pet" } })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(299)
    })
    expect(get).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    vi.useRealTimers()
    await screen.findByRole("button", { name: "Open post by Petr" })
    expect(get).toHaveBeenLastCalledWith(
      "quacks",
      expect.objectContaining({ searchParams: { q: "pet" } }),
    )
    await waitFor(() => expect(usage).toHaveBeenCalledWith("search"))
    fireEvent.click(screen.getByRole("button", { name: "Open post by Petr" }))
    expect(screen.getByRole("region", { name: "Opened post" })).toBeInTheDocument()
    expect(usage).toHaveBeenCalledWith("open")
    fireEvent.change(screen.getByLabelText("Search posts"), { target: { value: "   " } })
    expect(screen.queryByRole("button", { name: "Open post by Petr" })).not.toBeInTheDocument()
    expect(screen.getByText("Žlutý výlet")).toBeInTheDocument()
  })

  it("shows no matches and supports retry after failure", async () => {
    get.mockImplementation(() => ({ json: () => Promise.resolve([]) }))
    mount()
    await screen.findByText("No quacks yet. Post the first one.")
    get.mockImplementationOnce(() => ({
      json: () => Promise.reject(new Error("Offline")),
    }))
    fireEvent.change(screen.getByLabelText("Search posts"), { target: { value: "missing" } })
    await screen.findByText("Offline")
    expect(usage).not.toHaveBeenCalledWith("search")
    fireEvent.click(screen.getByRole("button", { name: /reload/i }))
    await screen.findByText("No posts match your search")
    await waitFor(() => expect(usage).toHaveBeenCalledWith("search"))
  })
})
