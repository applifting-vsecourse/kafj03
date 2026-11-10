import { useMutation, useQueryClient } from "@tanstack/react-query"

import { quackSessionGeneration } from "@/lib/quack-cache"
import { eraseCachedQuack } from "@/lib/quack-erasure"

import { deleteQuack } from "@/features/quack/api/deleteQuack"

export function useDeleteQuack() {
  const client = useQueryClient()
  const mutation = useMutation({
    mutationKey: ["quacks", "delete"],
    mutationFn: deleteQuack,
    onMutate: () => quackSessionGeneration(client),
    onSuccess: async (_, id, generation) => {
      if (generation === quackSessionGeneration(client)) {
        await eraseCachedQuack(client, id, new Date().toISOString())
      }
    },
  })
  return {
    ...mutation,
    confirmDelete: (id: string) => {
      if (
        !mutation.isPending &&
        window.confirm(
          "Permanently delete this post's content, including its poll and votes? Other people's replies will remain. This cannot be undone.",
        )
      ) {
        mutation.mutate(id)
      }
    },
  }
}
