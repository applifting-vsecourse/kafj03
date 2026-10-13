import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { QuackForm } from "@/features/quack/components/QuackForm"

const { mutate, mutationState } = vi.hoisted(() => ({
  mutate: vi.fn(),
  mutationState: { isPending: false, error: null as Error | null },
}))
vi.mock("@/features/quack/hooks/useAddQuack", () => ({
  useAddQuack: () => ({ mutate, ...mutationState }),
}))

describe("QuackForm", () => {
  beforeEach(() => {
    mutate.mockReset()
    mutationState.isPending = false
    mutationState.error = null
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

  it("preselects default mood and restores it after posting", async () => {
    mutate.mockImplementation((_input: unknown, callbacks: { onSuccess: () => void }) =>
      callbacks.onSuccess(),
    )
    render(<QuackForm defaultMood="sad" />)
    expect(screen.getByRole("button", { name: "sad" })).toHaveAttribute("aria-pressed", "true")
    await userEvent.type(screen.getByRole("textbox"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "happy" }))
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith({ text: "hello", mood: "happy" }, expect.any(Object)),
    )
    expect(screen.getByRole("button", { name: "sad" })).toHaveAttribute("aria-pressed", "true")
  })

  it("omits mood when none is selected", async () => {
    render(<QuackForm />)
    await userEvent.type(screen.getByRole("textbox"), "hello")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ text: "hello" }, expect.any(Object)))
  })
  it("submits a trimmed poll and removes it from the form after success", async () => {
    mutate.mockImplementation((_input: unknown, callbacks: { onSuccess: () => void }) =>
      callbacks.onSuccess(),
    )
    render(<QuackForm />)
    await userEvent.type(screen.getByLabelText("New quack"), "Lunch")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(screen.getByLabelText("Question"), "  Where?  ")
    await userEvent.type(screen.getByLabelText("Option 1"), " Pizza ")
    await userEvent.type(screen.getByLabelText("Option 2"), " Soup ")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { text: "Lunch", poll: { question: "Where?", options: ["Pizza", "Soup"] } },
        expect.any(Object),
      ),
    )
    expect(screen.queryByLabelText("Question")).not.toBeInTheDocument()
    expect(screen.getByLabelText("New quack")).toHaveValue("")
  })

  it("requires a question and options and rejects duplicate choices", async () => {
    render(<QuackForm />)
    await userEvent.type(screen.getByLabelText("New quack"), "Lunch")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Enter a question")).toBeInTheDocument()
    expect(screen.getAllByText("Enter an option")).toHaveLength(2)
    expect(mutate).not.toHaveBeenCalled()
    await userEvent.type(screen.getByLabelText("Question"), "Where?")
    await userEvent.type(screen.getByLabelText("Option 1"), "Pizza")
    await userEvent.type(screen.getByLabelText("Option 2"), " pizza ")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    expect(await screen.findByText("Options must be different")).toBeInTheDocument()
    expect(mutate).not.toHaveBeenCalled()
  })

  it("allows between two and five options and keeps their order when removing one", async () => {
    render(<QuackForm />)
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    expect(screen.getByRole("button", { name: "Remove option 1" })).toBeDisabled()
    for (let index = 0; index < 3; index++) {
      await userEvent.click(screen.getByRole("button", { name: "Add option" }))
    }
    expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled()
    await userEvent.type(screen.getByLabelText("Option 3"), "Third")
    await userEvent.click(screen.getByRole("button", { name: "Remove option 2" }))
    expect(screen.getByLabelText("Option 2")).toHaveValue("Third")
    expect(screen.getByRole("button", { name: "Add option" })).toBeEnabled()
  })

  it("omits a removed poll even if its fields are invalid", async () => {
    render(<QuackForm />)
    await userEvent.type(screen.getByLabelText("New quack"), "Lunch")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.click(screen.getByRole("button", { name: "Remove poll" }))
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledWith({ text: "Lunch" }, expect.any(Object)))
  })

  it("preserves all fields on failure and allows a retry", async () => {
    const { rerender } = render(<QuackForm />)
    await userEvent.type(screen.getByLabelText("New quack"), "Lunch")
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    await userEvent.type(screen.getByLabelText("Question"), "Where?")
    await userEvent.type(screen.getByLabelText("Option 1"), "Pizza")
    await userEvent.type(screen.getByLabelText("Option 2"), "Soup")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1))
    mutationState.error = new Error("Could not save the post")
    rerender(<QuackForm />)
    expect(screen.getByText("Could not save the post")).toBeInTheDocument()
    expect(screen.getByLabelText("New quack")).toHaveValue("Lunch")
    expect(screen.getByLabelText("Question")).toHaveValue("Where?")
    expect(screen.getByLabelText("Option 1")).toHaveValue("Pizza")
    expect(screen.getByLabelText("Option 2")).toHaveValue("Soup")
    await userEvent.click(screen.getByRole("button", { name: "Quack" }))
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(2))
  })

  it("disables editing and submitting while the post is saving", async () => {
    const { rerender } = render(<QuackForm />)
    await userEvent.click(screen.getByRole("button", { name: "Add poll" }))
    mutationState.isPending = true
    rerender(<QuackForm />)
    expect(screen.getByLabelText("New quack")).toBeDisabled()
    expect(screen.getByLabelText("Question")).toBeDisabled()
    expect(screen.getByLabelText("Option 1")).toBeDisabled()
    expect(screen.getByRole("button", { name: "Remove poll" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Add option" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "Quack" })).toBeDisabled()
  })
})
