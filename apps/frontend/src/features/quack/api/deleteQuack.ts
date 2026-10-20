import { HTTPError } from "ky"

import { api } from "@/lib/api-client"

export async function deleteQuack(id: string): Promise<void> {
  try {
    await api.delete(`quacks/${encodeURIComponent(id)}`)
  } catch (error) {
    if (!(error instanceof HTTPError && error.response.status === 404)) throw error
  }
}
