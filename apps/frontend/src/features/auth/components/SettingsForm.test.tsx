import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { HTTPError } from "@/lib/api-client"
import { authKeys } from "@/lib/auth-keys"
import { quackKeys } from "@/lib/quack-keys"

import { SettingsForm } from "@/features/auth/components/SettingsForm"

const { patch, success } = vi.hoisted(() => ({ patch: vi.fn(), success: vi.fn() }))
vi.mock("@/lib/api-client", async (importOriginal) => ({
  ...(await importOriginal()),
  api: { patch },
}))
vi.mock("sonner", () => ({ toast: { success } }))
const user = {
  id: "u1",
  email: "a@b.cz",
  username: "alice",
  name: "Alice",
  bio: "Hello",
  defaultMood: "happy" as const,
}
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(authKeys.session(), { user })
  render(
    <QueryClientProvider client={client}>
      <SettingsForm user={user} />
    </QueryClientProvider>,
  )
  return client
}
describe("SettingsForm", () => {
  beforeEach(() => {
    patch.mockReset()
    success.mockReset()
  })
  it("tabs through all fields and buttons without saving unchanged values", async () => {
    setup()
    const keyboard = userEvent.setup()
    const controls = [
      screen.getByLabelText("Username"),
      screen.getByLabelText("Display name"),
      screen.getByLabelText("Bio (optional)"),
      screen.getByLabelText("Default mood for new posts"),
      screen.getByRole("button", { name: "Save" }),
      screen.getByRole("button", { name: "Discard changes" }),
    ]
    for (const control of controls) {
      await keyboard.tab()
      expect(control).toHaveFocus()
    }
    await keyboard.tab({ shift: true })
    expect(controls[4]).toHaveFocus()
    await keyboard.keyboard("{Enter}")
    expect(patch).not.toHaveBeenCalled()
    await keyboard.tab()
    await keyboard.keyboard(" ")
    expect(screen.getByLabelText("Username")).toHaveValue("alice")
  })

  it("prefills saved values and discards edits", async () => {
    setup()
    expect(screen.getByLabelText("Username")).toHaveValue("alice")
    expect(screen.getByLabelText("Default mood for new posts")).toHaveValue("happy")
    await userEvent.type(screen.getByLabelText("Username"), "new")
    await userEvent.clear(screen.getByLabelText("Bio (optional)"))
    await userEvent.click(screen.getByRole("button", { name: "Discard changes" }))
    expect(screen.getByLabelText("Username")).toHaveValue("alice")
    expect(screen.getByLabelText("Bio (optional)")).toHaveValue("Hello")
    expect(patch).not.toHaveBeenCalled()
  })
  it("rejects invalid usernames before saving", async () => {
    setup()
    await userEvent.clear(screen.getByLabelText("Username"))
    await userEvent.type(screen.getByLabelText("Username"), "bad name")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("Use letters, numbers, dots and underscores")).toBeVisible()
    expect(patch).not.toHaveBeenCalled()
  })
  it("keeps edits on a username conflict", async () => {
    patch.mockReturnValue({
      json: () =>
        Promise.reject(
          new HTTPError(
            new Response(null, { status: 409 }),
            new Request("http://localhost/settings"),
            {} as never,
          ),
        ),
    })
    setup()
    await userEvent.clear(screen.getByLabelText("Username"))
    await userEvent.type(screen.getByLabelText("Username"), "taken")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(await screen.findByText("This username is already taken")).toBeVisible()
    expect(screen.getByLabelText("Username")).toHaveValue("taken")
  })
  it("updates session immediately and confirms saving", async () => {
    const updated = { ...user, username: "New.Name", bio: "Hello", defaultMood: null }
    patch.mockReturnValue({ json: () => Promise.resolve(updated) })
    const client = setup()
    client.setQueryData(quackKeys.lists(), [
      { id: "q1", text: "hello", user: { id: "u1", name: "Alice", username: "alice" } },
    ])
    await userEvent.clear(screen.getByLabelText("Username"))
    await userEvent.type(screen.getByLabelText("Username"), "New.Name")
    await userEvent.selectOptions(screen.getByLabelText("Default mood for new posts"), "")
    await userEvent.click(screen.getByRole("button", { name: "Save" }))
    await waitFor(() => expect(success).toHaveBeenCalled())
    expect(client.getQueryData(quackKeys.lists())).toEqual([
      { id: "q1", text: "hello", user: { id: "u1", name: "Alice", username: "New.Name" } },
    ])
    expect(client.getQueryData(authKeys.session())).toEqual({ user: updated })
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("aria-disabled", "true")
  })
})
