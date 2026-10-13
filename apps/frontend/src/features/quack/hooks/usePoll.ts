import { useEffect, useSyncExternalStore } from "react"
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query"

import { api, HTTPError } from "@/lib/api-client"
import { quackSessionGeneration } from "@/lib/quack-cache"

import { optimisticVote, storePoll } from "@/features/quack/api/pollState"
import { pollSync } from "@/features/quack/api/pollSync"
import { quackKeys } from "@/features/quack/api/quackKeys"
import { quackSchema, type Poll } from "@/features/quack/api/quackSchemas"
import { vote } from "@/features/quack/api/vote"

function subscribeOnline(callback: () => void): () => void {
  window.addEventListener("online", callback)
  window.addEventListener("offline", callback)
  return () => {
    window.removeEventListener("online", callback)
    window.removeEventListener("offline", callback)
  }
}

export function usePoll(quackId: string, initialPoll: Poll) {
  const queryClient = useQueryClient()
  const isOnline = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  )
  const sync = pollSync(queryClient)
  const syncStatus = useSyncExternalStore(sync.subscribe, sync.snapshot, () => "connecting")
  const canVote = isOnline && syncStatus !== "disconnected"
  const mutationKey = [...quackKeys.poll(quackId), "vote"]
  const query = useQuery({
    queryKey: quackKeys.poll(quackId),
    initialData: initialPoll,
    staleTime: Infinity,
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
    queryFn: async ({ signal }) => {
      const quack = quackSchema.parse(
        await api.get(`quacks/${encodeURIComponent(quackId)}`, { signal }).json(),
      )
      if (!quack.poll) throw new Error("Poll is no longer available")
      const current = queryClient.getQueryData<Poll>(quackKeys.poll(quackId))
      return current && current.revision > quack.poll.revision ? current : quack.poll
    },
  })
  useEffect(() => {
    const current = queryClient.getQueryData<Poll>(quackKeys.poll(quackId))
    if (!current || initialPoll.revision > current.revision) {
      storePoll(queryClient, quackId, initialPoll)
    }
  }, [initialPoll, quackId, queryClient])

  useEffect(() => {
    storePoll(queryClient, quackId, query.data)
  }, [query.data, queryClient, quackId])

  const mutation = useMutation({
    mutationKey,
    networkMode: "always",
    mutationFn: (optionId: string) => vote(quackId, optionId),
    onMutate: () => quackSessionGeneration(queryClient),
    onSuccess: (result, _optionId, generation) => {
      if (generation === quackSessionGeneration(queryClient)) {
        storePoll(queryClient, quackId, result)
      }
    },
    // A failed or timed-out request may still have committed on the server.
    // Reload the actual choice; the optimistic display never overwrites confirmed data.
    onError: (_error, _optionId, generation) => {
      if (generation !== quackSessionGeneration(queryClient)) return
      void queryClient.invalidateQueries({ queryKey: quackKeys.poll(quackId) })
    },
  })
  const mutations = useMutationState({
    filters: { mutationKey, exact: true },
    select: (entry) => ({
      status: entry.state.status,
      optionId: entry.state.variables as string | undefined,
      error: entry.state.error,
    }),
  })
  const latest = mutations.at(-1)
  const isPending = latest?.status === "pending"
  const confirmed = query.data
  const displayed =
    isPending && latest.optionId ? optimisticVote(confirmed, latest.optionId) : confirmed
  const error = latest?.status === "error" ? latest.error : null
  const errorMessage = error
    ? error instanceof HTTPError && error.response.status < 500
      ? error.message
      : "The vote could not be verified as saved."
    : null

  return {
    poll: displayed,
    isPending,
    isOnline,
    canVote,
    errorMessage,
    isStale: !isOnline || query.isError || syncStatus !== "connected",
    select: (optionId: string) => {
      if (
        !canVote ||
        queryClient.isMutating({ mutationKey, exact: true }) ||
        optionId === confirmed.myOptionId
      ) {
        return
      }
      mutation.mutate(optionId)
    },
    retry: () => {
      if (latest?.optionId && canVote && !queryClient.isMutating({ mutationKey, exact: true })) {
        mutation.mutate(latest.optionId)
      }
    },
  }
}
