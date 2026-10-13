import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll as PollData } from "@/features/quack/api/quackSchemas"

import { Poll } from "./Poll"

const { vote, get } = vi.hoisted(() => ({ vote: vi.fn(), get: vi.fn() }))
vi.mock("@/features/quack/api/vote", () => ({ vote }))
vi.mock("@/lib/api-client", async () => {
  const { HTTPError } = await import("ky")
  return { api: { get }, HTTPError }
})
vi.mock("@/features/quack/api/pollSync", () => ({
  pollSync: () => ({ subscribe: () => () => undefined, snapshot: () => "connected" }),
}))
const initial: PollData = {
  id: "p",
  question: "Lunch?",
  revision: 0,
  totalVotes: 0,
  myOptionId: null,
  options: [
    { id: "a", text: "Pizza", position: 0, votes: 0, percentage: 0 },
    { id: "b", text: "Soup", position: 1, votes: 0, percentage: 0 },
  ],
}
const saved: PollData = {
  ...initial,
  revision: 1,
  totalVotes: 1,
  myOptionId: "a",
  options: [{ ...initial.options[0]!, votes: 1, percentage: 100 }, initial.options[1]!],
}
let client: QueryClient
const clients: QueryClient[] = []
function setup(poll = initial, copies = 1) {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  clients.push(client)
  return render(
    <QueryClientProvider client={client}>
      {Array.from({ length: copies }, (_, i) => (
        <Poll
          key={i}
          quackId="q"
          poll={poll}
        />
      ))}
    </QueryClientProvider>,
  )
}
function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: Error) => void
  const promise = new Promise<T>((done, fail) => {
    resolve = done
    reject = fail
  })
  return { promise, resolve, reject }
}

describe("Poll voting", () => {
  beforeEach(() => {
    vote.mockReset()
    get.mockReset()
    get.mockReturnValue({
      json: () =>
        Promise.resolve({
          id: "q",
          text: "Lunch",
          userId: "u",
          createdAt: new Date().toISOString(),
          user: { id: "u", name: "Duck", username: "duck" },
          poll: initial,
        }),
    })
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true })
  })
  afterEach(() => {
    clients.splice(0).forEach((item) => item.clear())
  })

  it("shows zero results before voting", () => {
    setup()
    expect(screen.getByText("0 voters")).toBeInTheDocument()
    expect(screen.getAllByText("0 · 0%")).toHaveLength(2)
    expect(screen.getByRole("button", { name: /Pizza/ })).toHaveAttribute("aria-pressed", "false")
  })

  it("updates immediately and blocks both copies until saved", async () => {
    const pending = deferred<PollData>()
    vote.mockReturnValue(pending.promise)
    setup(initial, 2)
    await userEvent.click(screen.getAllByRole("button", { name: /Pizza/ })[0]!)
    await waitFor(() => expect(screen.getAllByText("Saving vote…")).toHaveLength(2))
    expect(screen.getAllByText("1 voter")).toHaveLength(2)
    expect(screen.getAllByText("1 · 100%")).toHaveLength(2)
    screen
      .getAllByRole("button", { name: /Soup/ })
      .forEach((button) => expect(button).toBeDisabled())
    expect(vote).toHaveBeenCalledTimes(1)
    await act(async () => {
      pending.resolve(saved)
      await pending.promise
    })
    await waitFor(() => expect(screen.queryByText("Saving vote…")).not.toBeInTheDocument())
    screen
      .getAllByRole("button", { name: /Pizza/ })
      .forEach((button) => expect(button).toHaveAttribute("aria-pressed", "true"))
    expect(client.getQueryData(quackKeys.poll("q"))).toEqual(saved)
  })

  it("moves an existing vote without increasing the total", async () => {
    const pending = deferred<PollData>()
    vote.mockReturnValue(pending.promise)
    setup(saved)
    await userEvent.click(screen.getByRole("button", { name: /Soup/ }))
    expect(screen.getByText("1 voter")).toBeInTheDocument()
    expect(
      within(screen.getByRole("button", { name: /Pizza/ })).getByText("0 · 0%"),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Soup/ })).toHaveAttribute("aria-pressed", "true")
    await act(async () => {
      pending.resolve({
        ...saved,
        revision: 2,
        myOptionId: "b",
        options: [initial.options[0]!, { ...initial.options[1]!, votes: 1, percentage: 100 }],
      })
      await pending.promise
    })
  })

  it("restores confirmed results on an uncertain failure and supports retry", async () => {
    const pending = deferred<PollData>()
    vote.mockReturnValueOnce(pending.promise).mockResolvedValue(saved)
    setup()
    await userEvent.click(screen.getByRole("button", { name: /Pizza/ }))
    await act(async () => {
      pending.reject(new Error("Request timed out"))
      await pending.promise.catch(() => undefined)
    })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The vote could not be verified as saved.",
    )
    expect(screen.getByText("0 voters")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pizza/ })).toHaveAttribute("aria-pressed", "false")
    await waitFor(() => expect(get).toHaveBeenCalled())
    await userEvent.click(screen.getByRole("button", { name: "Retry vote" }))
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument())
    expect(vote).toHaveBeenCalledTimes(2)
    expect(screen.getByText("1 voter")).toBeInTheDocument()
  })

  it("reconciles an ambiguous failure with a vote that actually saved", async () => {
    get.mockReturnValue({
      json: () =>
        Promise.resolve({
          id: "q",
          text: "Lunch",
          userId: "u",
          createdAt: new Date().toISOString(),
          user: { id: "u", name: "Duck", username: "duck" },
          poll: saved,
        }),
    })
    vote.mockRejectedValue(new Error("Lost confirmation"))
    setup()
    await userEvent.click(screen.getByRole("button", { name: /Pizza/ }))
    await waitFor(() => expect(screen.getByText("1 voter")).toBeInTheDocument())
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Pizza/ })).toHaveAttribute("aria-pressed", "true"),
    )
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })

  it("does not send the same confirmed choice again", async () => {
    setup(saved)
    await userEvent.click(screen.getByRole("button", { name: /Pizza/ }))
    expect(vote).not.toHaveBeenCalled()
  })

  it("disables voting and marks results stale while offline", () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false })
    setup()
    expect(screen.getByText(/You are offline/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Pizza/ })).toBeDisabled()
  })
})
