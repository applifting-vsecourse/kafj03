import { api } from "@/lib/api-client"

import { pollSchema, type Poll } from "@/features/quack/api/quackSchemas"

export async function vote(quackId: string, optionId: string): Promise<Poll> {
  return pollSchema.parse(
    await api
      .put(`quacks/${encodeURIComponent(quackId)}/poll/vote`, {
        json: { optionId },
        timeout: 10_000,
      })
      .json(),
  )
}
