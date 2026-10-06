import { queryOptions } from "@tanstack/react-query"

import { api } from "@/lib/api-client"

import { quackKeys } from "@/features/quack/api/quackKeys"
import { quacksSchema } from "@/features/quack/api/quackSchemas"

export const quacksQueryOptions = (query = "") =>
  queryOptions({
    queryKey: [...quackKeys.lists(), query],
    queryFn: async ({ signal }) =>
      quacksSchema.parse(
        await api.get("quacks", { searchParams: query ? { q: query } : {}, signal }).json(),
      ),
  })
