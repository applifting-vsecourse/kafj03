import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/lib/quack-keys"

const generations = new WeakMap<QueryClient, number>()
export function quackSessionGeneration(client: QueryClient): number {
  return generations.get(client) ?? 0
}

export async function resetQuackSession(client: QueryClient): Promise<void> {
  // Ignore late vote confirmations belonging to the previous account.
  generations.set(client, quackSessionGeneration(client) + 1)
  await client.cancelQueries({ queryKey: quackKeys.all() })
  client.removeQueries({ queryKey: quackKeys.all() })
  for (const mutation of client.getMutationCache().findAll({ mutationKey: quackKeys.all() })) {
    client.getMutationCache().remove(mutation)
  }
}
