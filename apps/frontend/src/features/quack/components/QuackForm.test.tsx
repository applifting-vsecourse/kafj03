import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { QuackForm } from "@/features/quack/components/QuackForm"

const { mutate } = vi.hoisted(() => ({ mutate: vi.fn() }))
vi.mock("@/features/quack/hooks/useAddQuack", () => ({
  useAddQuack: () => ({ mutate, isPending: false, error: null }),
}))

describe("QuackForm", () => {
  beforeEach(() => {
    mutate.mockReset()
  })

  it.each(["happy", "sad", "angry", "silly"])(
    "submits %s mood and resets after success",
    async (mood) => {
      mutate.mockImplementation((_input: unknown, callbacks: { onSuccess: () => void }) =>
        callbacks.onSuccess(),
      )
      render(<QuackForm />)
      await userEvent.type(screen.getByRole("textbox"), "hello")
      await userEvent.click(screen.getByRole("button", { name: mood }))
      await userEvent.click(screen.getByRole("button", { name: "Quack" }))
      await waitFor(() =>
        expect(mutate).toHaveBeenCalledWith({ text: "hello", mood }, expect.any(Object)),
      )
      await waitFor(() =>
        expect(screen.getByRole("button", { name: mood })).toHaveAttribute("aria-pressed", "false"),
      )
      expect(screen.getByRole("textbox")).toHaveValue("")
    },
  )

  it("switches moods and clears the selection on a second click", async () => {
    render(<QuackForm />)
    const happy = screen.getByRole("button", { name: "happy" })
    const sad = screen.getByRole("button", { name: "sad" })
    await userEvent.click(happy)
    expect(happy).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(sad)
    expect(happy).toHaveAttribute("aria-pressed", "false")
    expect(sad).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(sad)
    expect(sad).toHaveAttribute("aria-pressed", "false")
    await userEvent.type(screen.getByRole("textbox"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ text: "hello" }, expect.any(Object)))
  })

  it("omits mood when none is selected", async () => {
    render(<QuackForm />)
    await userEvent.type(screen.getByRole("textbox"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ text: "hello" }, expect.any(Object)))
  })
})
