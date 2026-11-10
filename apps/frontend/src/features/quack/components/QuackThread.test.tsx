import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { QuackThread } from "./QuackThread"

const get = vi.hoisted(() => vi.fn())
const post = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api-client", () => ({ api: { get, post } }))
const root = {
  id: "root",
  text: "Original",
  userId: "author",
  user: { id: "author", name: "Author", username: "author" },
  createdAt: "2026-11-10T00:00:00Z",
  parentId: null,
  rootId: null,
  replyCount: 1,
}
const reply = {
  ...root,
  id: "reply",
  text: "Response",
  userId: "viewer",
  user: { id: "viewer", name: "Viewer", username: "viewer" },
  parentId: "root",
  rootId: "root",
}
function mount(target?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <QuackThread
        id="root"
        reply={target}
        user={{ id: "viewer" }}
      />
    </QueryClientProvider>,
  )
}
afterEach(() => vi.clearAllMocks())
describe("QuackThread", () => {
  it("shows an erased root while keeping a live reply and supports responding to the reply", async () => {
    const erased = {
      ...root,
      text: null,
      user: null,
      userId: null,
      deletedAt: "2026-11-10T12:00:00Z",
    }
    get.mockImplementation((url: string) => ({
      json: () =>
        Promise.resolve(
          url.endsWith("/replies")
            ? { items: [reply], nextCursor: null }
            : url.endsWith("/reply")
              ? reply
              : erased,
        ),
    }))
    post.mockImplementation(() => ({ json: () => Promise.resolve({ ...reply, id: "new-reply" }) }))
    mount()
    await screen.findByText("This quack was deleted")
    await screen.findByText("Response")
    fireEvent.change(screen.getByRole("textbox", { name: "Reply" }), {
      target: { value: "Draft kept" },
    })
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" })[1]!)
    await screen.findByText("Reply to Viewer: Response")
    expect(screen.getByRole("textbox", { name: "Reply" })).toHaveValue("Draft kept")
    fireEvent.click(screen.getAllByRole("button", { name: "Reply" }).at(-1)!)
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("quacks", {
        json: { text: "Draft kept", parentId: "reply" },
      }),
    )
  })
  it("requests the target page directly without loading earlier pages", async () => {
    get.mockImplementation((url: string) => ({
      json: () =>
        Promise.resolve(url.endsWith("/replies") ? { items: [reply], nextCursor: null } : root),
    }))
    mount("reply")
    await screen.findByText("Response")
    expect(get).toHaveBeenCalledWith(
      "quacks/root/replies",
      expect.objectContaining({ searchParams: { target: "reply" } }),
    )
    expect(document.activeElement?.id).toBe("quack-reply")
  })
  it("shows a retry instead of loading forever when the discussion does not exist", async () => {
    get.mockImplementation(() => ({
      json: () => Promise.reject(new Error("Not found")),
    }))
    mount()
    await screen.findByRole("alert")
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument()
  })
})
