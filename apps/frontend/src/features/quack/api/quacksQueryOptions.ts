import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema, quacksSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (query = "") =>
  queryOptions({
    queryKey: [...quackKeys.lists(), query],
    queryFn: async ({ signal }) =>
      quacksSchema.parse(
        await api.get("quacks", { searchParams: query ? { q: query } : {}, signal }).json(),
      ),
  })

export const quackQueryOptions = (id: string) =>
  queryOptions({
    queryKey: quackKeys.detail(id),
    queryFn: async ({ signal }) =>
      quackSchema.parse(await api.get(`quacks/${encodeURIComponent(id)}`, { signal }).json()),
  })
