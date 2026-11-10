import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/lib/quack-keys"

const erased = new WeakMap<QueryClient, Map<string, string>>()
export function isQuackErased(client: QueryClient, id: string): boolean {
  return erased.get(client)?.has(id) ?? false
}

// Covers lists, details, infinite pages, and embedded parent previews. Also used
// on incoming responses so an old in-flight read cannot resurrect erased content.
export function sanitizeDeleted<T>(client: QueryClient, value: T): T {
  if (!value || typeof value !== "object" || value instanceof Date) return value
  if (Array.isArray(value)) {
    return (value as unknown[]).map((item) => sanitizeDeleted(client, item)) as T
  }
  const obj = value as Record<string, unknown>
  const deletedAt =
    obj.deletedAt instanceof Date
      ? obj.deletedAt.toISOString()
      : typeof obj.deletedAt === "string"
        ? obj.deletedAt
        : undefined
  if (typeof obj.id === "string" && deletedAt && "text" in obj) {
    let known = erased.get(client)
    if (!known) {
      known = new Map()
      erased.set(client, known)
    }
    known.set(obj.id, deletedAt)
  }
  const date = typeof obj.id === "string" ? erased.get(client)?.get(obj.id) : undefined
  const result = Object.fromEntries(
    Object.entries(obj).map(([key, item]) => [key, sanitizeDeleted(client, item)]),
  )
  if (date && "text" in obj) {
    Object.assign(result, { text: null, user: null, deletedAt: date })
    if ("userId" in obj) {
      Object.assign(result, { userId: null, mood: null, poll: null, parent: null })
    }
  }
  return result as T
}

export async function eraseCachedQuack(
  client: QueryClient,
  id: string,
  deletedAt: string,
): Promise<void> {
  let known = erased.get(client)
  if (!known) {
    known = new Map()
    erased.set(client, known)
  }
  known.set(id, deletedAt)
  await client.cancelQueries({ queryKey: quackKeys.all() })
  client.setQueriesData(
    { queryKey: quackKeys.all(), predicate: (q) => q.queryKey[1] !== "poll" },
    (data) => sanitizeDeleted(client, data),
  )
  client.removeQueries({ queryKey: quackKeys.poll(id), exact: true })
  for (const mutation of client.getMutationCache().findAll({ mutationKey: quackKeys.all() })) {
    if (mutation.state.status !== "pending") client.getMutationCache().remove(mutation)
  }
  await client.invalidateQueries({
    queryKey: quackKeys.all(),
    predicate: (q) => q.queryKey[1] !== "poll",
  })
}
