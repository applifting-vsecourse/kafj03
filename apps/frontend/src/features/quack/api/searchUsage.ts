import { api } from "@/lib/api-client"

export function recordSearchUsage(event: "feed" | "search" | "open") {
  // Analytics failure must never prevent reading or searching the feed.
  void api.post("quacks/usage", { json: { event } }).catch(() => undefined)
}
