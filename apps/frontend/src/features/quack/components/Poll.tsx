import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"

import type { Poll as PollData } from "@/features/quack/api/quackSchemas"
import { usePoll } from "@/features/quack/hooks/usePoll"

export function Poll({ quackId, poll: initialPoll }: { quackId: string; poll: PollData }) {
  const { poll, isPending, isOnline, isStale, errorMessage, select, retry } = usePoll(
    quackId,
    initialPoll,
  )
  return (
    <section
      aria-label={`Poll: ${poll.question}`}
      className="mt-3 space-y-2 border-t border-border pt-3"
      aria-busy={isPending}
    >
      <p className="font-medium break-words">{poll.question}</p>
      <div
        role="group"
        aria-label="Choose one answer"
        className="flex flex-col gap-2"
      >
        {poll.options.map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={poll.myOptionId === option.id ? "secondary" : "outline"}
            className="h-auto justify-between gap-3 text-left whitespace-normal"
            aria-pressed={poll.myOptionId === option.id}
            disabled={isPending || !isOnline}
            onClick={() => select(option.id)}
          >
            <span className="min-w-0 break-words">{option.text}</span>
            <span className="shrink-0 text-sm text-muted-foreground">
              {option.votes} · {option.percentage}%
            </span>
          </Button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {poll.totalVotes} {poll.totalVotes === 1 ? "voter" : "voters"}
      </p>
      {isPending ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin"
          />
          Saving vote…
        </p>
      ) : null}
      {isStale ? (
        <p
          role="status"
          className="text-sm text-muted-foreground"
        >
          Results may be out of date.{!isOnline ? " You are offline." : ""}
        </p>
      ) : null}
      {errorMessage ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-2"
        >
          <p className="text-sm text-destructive">{errorMessage}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending || !isOnline}
            onClick={retry}
          >
            Retry vote
          </Button>
        </div>
      ) : null}
    </section>
  )
}
