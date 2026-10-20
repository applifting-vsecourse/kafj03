import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuackFeed } from "./QuackFeed"

const get = vi.hoisted(() => vi.fn())
const usage = vi.hoisted(() => vi.fn())
const remove = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api-client", () => ({ api: { get, delete: remove } }))
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
      <QuackFeed currentUserId="u1" />
    </QueryClientProvider>,
  )

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe("QuackFeed", () => {
  it("filters own posts, confirms deletion, and removes the post from both views", async () => {
    const other = { ...post, id: "q2", userId: "u2", text: "Other post" }
    let posts = [post, other]
    get.mockImplementation(() => ({ json: () => Promise.resolve(posts) }))
    remove.mockImplementation(() => {
      posts = [other]
      return Promise.resolve()
    })
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false)
    mount()
    await screen.findByText("Other post")
    expect(screen.getAllByRole("button", { name: "Smazat" })).toHaveLength(1)
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Moje" }), { button: 0, ctrlKey: false })
    expect(screen.queryByText("Other post")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }))
    expect(remove).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole("button", { name: "Smazat" }))
    await screen.findByText("Zatím nemáte žádné příspěvky.")
    expect(screen.getByRole("button", { name: "Napsat první příspěvek" })).toBeInTheDocument()
    expect(remove).toHaveBeenCalledWith("quacks/q1")
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Vše" }), { button: 0, ctrlKey: false })
    expect(screen.getByText("Other post")).toBeInTheDocument()
    expect(screen.queryByText(post.text)).not.toBeInTheDocument()
    confirm.mockRestore()
  })

  it("keeps the post and shows an error when deletion fails", async () => {
    get.mockImplementation(() => ({ json: () => Promise.resolve([post]) }))
    remove.mockRejectedValueOnce(new Error("Offline"))
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true)
    mount()
    fireEvent.click(await screen.findByRole("button", { name: "Smazat" }))
    await screen.findByRole("alert")
    expect(screen.getByText(post.text)).toBeInTheDocument()
    confirm.mockRestore()
  })

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
