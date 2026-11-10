import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"
import { sanitizeDeleted } from "@/lib/quack-erasure"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema, quacksSchema, replyPageSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (query = "", scope: "all" | "mine" = "all") =>
  queryOptions({
    queryKey: [...quackKeys.lists(), query, scope],
    queryFn: async ({ signal, client }) =>
      quacksSchema.parse(
        sanitizeDeleted(
          client,
          await api
            .get("quacks", {
              searchParams: {
                ...(query ? { q: query } : {}),
                ...(scope === "mine" ? { scope } : {}),
              },
              signal,
            })
            .json(),
        ),
      ),
  })

export const quackQueryOptions = (id: string) =>
  queryOptions({
    queryKey: quackKeys.detail(id),
    queryFn: async ({ signal, client }) =>
      quackSchema.parse(
        sanitizeDeleted(
          client,
          await api.get(`quacks/${encodeURIComponent(id)}`, { signal }).json(),
        ),
      ),
  })

export const repliesQueryOptions = (id: string, target?: string) =>
  infiniteQueryOptions({
    queryKey: [...quackKeys.replies(id), target ?? ""],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ signal, client, pageParam }) =>
      replyPageSchema.parse(
        sanitizeDeleted(
          client,
          await api
            .get(`quacks/${encodeURIComponent(id)}/replies`, {
              signal,
              searchParams: pageParam ? { cursor: pageParam } : target ? { target } : {},
            })
            .json(),
        ),
      ),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  })
