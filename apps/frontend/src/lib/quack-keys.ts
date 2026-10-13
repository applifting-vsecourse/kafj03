export const quackKeys = {
  all: () => ["quacks"] as const,
  details: () => [...quackKeys.all(), "detail"] as const,
  detail: (id: string) => [...quackKeys.details(), id] as const,
  poll: (id: string) => [...quackKeys.all(), "poll", id] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
}
