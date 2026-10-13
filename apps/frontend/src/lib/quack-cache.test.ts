import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { authKeys } from "./auth-keys"
import { quackSessionGeneration, resetQuackSession } from "./quack-cache"
import { quackKeys } from "./quack-keys"

describe("viewer-specific quack cache", () => {
  it("removes previous account's polls, feed, details and mutations while preserving auth", async () => {
    const client = new QueryClient()
    client.setQueryData(quackKeys.poll("q"), { myOptionId: "a" })
    client.setQueryData(quackKeys.detail("q"), { id: "q" })
    client.setQueryData([...quackKeys.lists(), ""], [])
    client.setQueryData(authKeys.session(), { user: { id: "next-user" } })
    client.getMutationCache().build(client, { mutationKey: [...quackKeys.poll("q"), "vote"] })
    const before = quackSessionGeneration(client)
    await resetQuackSession(client)
    expect(client.getQueriesData({ queryKey: quackKeys.all() })).toEqual([])
    expect(client.getMutationCache().getAll()).toEqual([])
    expect(client.getQueryData(authKeys.session())).toEqual({ user: { id: "next-user" } })
    expect(quackSessionGeneration(client)).toBe(before + 1)
    client.clear()
  })
})
