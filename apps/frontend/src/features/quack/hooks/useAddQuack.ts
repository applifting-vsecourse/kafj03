import { useMutation, useQueryClient } from "@tanstack/react-query"

import { quackSessionGeneration } from "@/lib/quack-cache"
import { sanitizeDeleted } from "@/lib/quack-erasure"

import { addQuack } from "@/features/quack/api/addQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema } from "@/features/quack/api/quackSchemas"

// The hook owns the mutation only — form state belongs to react-hook-form
// in the component, the same way the auth forms do it.
export function useAddQuack() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: quackKeys.all(),
    mutationFn: async (input: Parameters<typeof addQuack>[0]) => {
      const generation = quackSessionGeneration(queryClient)
      const result = await addQuack(input)
      if (generation !== quackSessionGeneration(queryClient)) {
        throw new Error("Account changed while sending the post")
      }
      return quackSchema.parse(sanitizeDeleted(queryClient, result))
    },
    onMutate: () => quackSessionGeneration(queryClient),
    onSuccess: async (_result, _input, generation) => {
      if (generation !== quackSessionGeneration(queryClient)) return
      // Refresh the list so the new quack shows up.
      await queryClient.invalidateQueries({ queryKey: quackKeys.all() })
    },
  })
}
