export const quackKeys = {
  all: () => ["quacks"] as const,
  details: () => [...quackKeys.all(), "detail"] as const,
  detail: (id: string) => [...quackKeys.details(), id] as const,
  lists: () => [...quackKeys.all(), "list"] as const,
}
