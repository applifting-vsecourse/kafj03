export const quackKeys = {
  all: () => ["quacks"] as const,
  details: () => [...quackKeys.all(), "detail"] as const,
  detail: (id: string) => [...quackKeys.details(), id] as const,
  polls: () => [...quackKeys.all(), "poll"] as const,
  poll: (id: string) => [...quackKeys.polls(), id] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
}
