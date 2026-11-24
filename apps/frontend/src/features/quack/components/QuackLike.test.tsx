import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { expect, it, vi } from "vitest"

import { resetQuackSession } from "@/lib/quack-cache"

import { quackKeys } from "@/features/quack/api/quackKeys"

import { QuackLike } from "./QuackLike"

const put = vi.hoisted(() => vi.fn())
vi.mock("@/lib/api-client", () => ({ api: { put } }))

it("ignores a like confirmation from the previous account", async () => {
  const client = new QueryClient()
  const invalidate = vi.spyOn(client, "invalidateQueries")
  const request = Promise.withResolvers<void>()
  put.mockReturnValue(request.promise)
  render(
    <QueryClientProvider client={client}>
      <QuackLike
        id="quack-1"
        likeCount={0}
        likedByMe={false}
      />
    </QueryClientProvider>,
  )

  const button = screen.getByRole("button", { name: "Like" })
  fireEvent.click(button)
  await waitFor(() => expect(put).toHaveBeenCalledWith("quacks/quack-1/like"))
  expect(button).toBeDisabled()

  await act(async () => {
    await resetQuackSession(client)
    client.setQueryData(quackKeys.detail("quack-1"), { likeCount: 2, likedByMe: true })
    request.resolve()
  })
  await waitFor(() => expect(button).toBeEnabled())
  expect(invalidate).not.toHaveBeenCalled()
  expect(client.getQueryData(quackKeys.detail("quack-1"))).toEqual({
    likeCount: 2,
    likedByMe: true,
  })
})
