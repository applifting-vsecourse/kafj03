import { useId } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Heart } from "lucide-react"

import { Button } from "@/components/ui/button"
import { api } from "@/lib/api-client"
import { quackSessionGeneration } from "@/lib/quack-cache"

import { quackKeys } from "@/features/quack/api/quackKeys"

export function QuackLike({
  id,
  likeCount,
  likedByMe: isLiked,
}: {
  id: string
  likeCount: number
  likedByMe: boolean
}) {
  const countId = useId()
  const client = useQueryClient()
  const mutation = useMutation({
    mutationKey: [...quackKeys.all(), "like", id],
    mutationFn: async ({ shouldLike }: { shouldLike: boolean; generation: number }) => {
      const path = `quacks/${encodeURIComponent(id)}/like`
      await (shouldLike ? api.put(path) : api.delete(path))
    },
    onSuccess: async (_, { generation }) => {
      if (generation !== quackSessionGeneration(client)) return
      await client.invalidateQueries({
        queryKey: quackKeys.all(),
        predicate: (query) => query.queryKey[1] !== "poll",
      })
    },
  })
  const isCurrentSession = mutation.variables?.generation === quackSessionGeneration(client)

  return (
    <>
      <Button
        type="button"
        variant={isLiked ? "secondary" : "ghost"}
        size="sm"
        aria-label="Like"
        aria-pressed={isLiked}
        aria-describedby={countId}
        disabled={mutation.isPending && isCurrentSession}
        onClick={() =>
          mutation.mutate({ shouldLike: !isLiked, generation: quackSessionGeneration(client) })
        }
      >
        <Heart
          aria-hidden="true"
          className={isLiked ? "fill-current" : undefined}
        />
        <span id={countId}>
          <span data-testid="like-count">{likeCount}</span>
          <span className="sr-only">{likeCount === 1 ? " like" : " likes"}</span>
        </span>
      </Button>
      {mutation.isError && isCurrentSession ? (
        <p
          role="alert"
          className="text-sm text-destructive"
        >
          Could not update your like. Please try again.
        </p>
      ) : null}
    </>
  )
}
