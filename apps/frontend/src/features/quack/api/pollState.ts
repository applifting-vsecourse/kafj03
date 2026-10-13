import type { QueryClient } from "@tanstack/react-query"

import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Poll, Quack } from "@/features/quack/api/quackSchemas"

export function optimisticVote(poll: Poll, optionId: string): Poll {
  if (poll.myOptionId === optionId) return poll
  const totalVotes = poll.totalVotes + (poll.myOptionId ? 0 : 1)
  return {
    ...poll,
    totalVotes,
    myOptionId: optionId,
    options: poll.options.map((option) => {
      const votes =
        option.votes + (option.id === optionId ? 1 : 0) - (option.id === poll.myOptionId ? 1 : 0)
      return {
        ...option,
        votes,
        percentage: totalVotes ? Math.round((votes * 100) / totalVotes) : 0,
      }
    }),
  }
}

export function storePoll(queryClient: QueryClient, quackId: string, poll: Poll): void {
  queryClient.setQueryData<Poll>(quackKeys.poll(quackId), (current) =>
    current && current.revision > poll.revision ? current : poll,
  )
  const update = (quack: Quack): Quack =>
    quack.id === quackId && (!quack.poll || quack.poll.revision <= poll.revision)
      ? { ...quack, poll }
      : quack
  queryClient.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (current) =>
    current?.map(update),
  )
  queryClient.setQueriesData<Quack>({ queryKey: quackKeys.detail(quackId) }, (current) =>
    current ? update(current) : current,
  )
}
