import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { eraseCachedQuack, sanitizeDeleted } from "@/lib/quack-erasure"
import { quackKeys } from "@/lib/quack-keys"

import { storePoll } from "@/features/quack/api/pollState"
import type { Poll } from "@/features/quack/api/quackSchemas"

const root = {
  id: "root",
  text: "private",
  userId: "author",
  user: { id: "author", name: "Author" },
  mood: "happy",
  poll: null,
  deletedAt: null,
}
describe("quack erasure cache", () => {
  it("erases content, author and embedded previews across lists, details and infinite pages", async () => {
    const client = new QueryClient()
    client.setQueryData(quackKeys.detail("root"), root)
    client.setQueryData(quackKeys.lists(), [root])
    client.setQueryData(quackKeys.replies("root"), {
      pages: [{ items: [{ id: "reply", text: "Keep", userId: "other", parent: root }] }],
    })
    await eraseCachedQuack(client, "root", "2026-11-10T12:00:00Z")
    expect(client.getQueryData(quackKeys.detail("root"))).toMatchObject({
      text: null,
      userId: null,
      user: null,
      mood: null,
    })
    const pages = client.getQueryData<{ pages: { items: { text: string; parent: unknown }[] }[] }>(
      quackKeys.replies("root"),
    )!
    expect(pages.pages[0]!.items[0]!).toMatchObject({
      text: "Keep",
      parent: { text: null, user: null },
    })
    expect(JSON.stringify(client.getQueryData(quackKeys.lists()))).not.toContain("private")
    client.clear()
  })
  it("sanitizes a late response and rejects a late vote result for an erased quack", async () => {
    const client = new QueryClient()
    await eraseCachedQuack(client, "root", "2026-11-10T12:00:00Z")
    expect(sanitizeDeleted(client, root)).toMatchObject({ text: null, userId: null, poll: null })
    storePoll(client, "root", { id: "poll", revision: 99 } as Poll)
    expect(client.getQueryData(quackKeys.poll("root"))).toBeUndefined()
    client.clear()
  })
})
