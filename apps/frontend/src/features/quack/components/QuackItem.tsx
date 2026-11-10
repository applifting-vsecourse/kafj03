import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/date"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { recordSearchUsage } from "@/features/quack/api/searchUsage"
import { Poll } from "@/features/quack/components/Poll"
import { UsersName } from "@/features/quack/components/UsersName"
import { UsersUserName } from "@/features/quack/components/UsersUserName"

type QuackItemProps = {
  returnTo?: string
  quack: Quack
  onReply?: () => void
  onOpen?: () => void
  onDelete?: () => void
  isDeleting?: boolean
}

export function QuackItem({
  quack,
  onOpen,
  onDelete,
  isDeleting,
  onReply,
  returnTo,
}: QuackItemProps) {
  const threadId = quack.rootId ?? quack.id
  const from =
    returnTo ??
    (typeof window === "undefined"
      ? "/quacks"
      : `${window.location.pathname}${window.location.search}`)
  const href = (target?: string) =>
    `/quacks/${encodeURIComponent(threadId)}?${new URLSearchParams({ ...(target && target !== threadId ? { reply: target } : {}), ...(from.startsWith("/quacks?") || from === "/quacks" ? { from } : {}) })}`
  if (quack.deletedAt || !quack.user) {
    return (
      <article
        id={`quack-${quack.id}`}
        className="border-b border-border py-4"
      >
        <p className="text-sm text-muted-foreground">This quack was deleted</p>
        <div className="mt-2 flex gap-4">
          {onReply ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReply}
            >
              Reply
            </Button>
          ) : null}
          {onReply ? (
            <a
              className="text-sm underline"
              href={href(quack.id)}
            >
              Permalink
            </a>
          ) : null}
          {!onReply ? (
            <a
              className="text-sm underline"
              href={href(quack.rootId ? quack.id : undefined)}
            >
              Replies ({quack.replyCount ?? 0})
            </a>
          ) : null}
        </div>
      </article>
    )
  }
  const { name, username } = quack.user

  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  return (
    <article
      id={`quack-${quack.id}`}
      className="flex w-full gap-4 border-b border-border pt-2 pb-4 last:border-b-0"
    >
      <Avatar className="size-12">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-baseline gap-2">
          <span>
            <UsersName name={name} /> <UsersUserName username={username} />
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <time className="text-xs text-muted-foreground">{formatDate(quack.createdAt)}</time>
        </div>
        {quack.mood ? (
          <span
            className="w-fit rounded-full bg-muted px-2 py-0.5 text-xs"
            aria-label={`Mood: ${quack.mood}`}
          >
            {quack.mood}
          </span>
        ) : null}
        {quack.parent ? (
          <a
            href={href(quack.parent.id)}
            className="text-sm text-muted-foreground underline"
          >
            {quack.parent.deletedAt
              ? "Reply to a deleted quack"
              : `Reply to ${quack.parent.user?.name ?? "quack"}: ${quack.parent.text ?? ""}`}
          </a>
        ) : null}
        <p className="text-sm break-words whitespace-pre-line">{quack.text}</p>
        {quack.poll ? (
          <Poll
            quackId={quack.id}
            poll={quack.poll}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          {onReply ? (
            <a
              className="text-sm underline"
              href={href(quack.id)}
            >
              Permalink
            </a>
          ) : null}
          {onReply ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReply}
            >
              Reply
            </Button>
          ) : (
            <a
              className="text-sm underline"
              onClick={() => {
                if (new URLSearchParams(window.location.search).has("q")) recordSearchUsage("open")
              }}
              href={href(quack.rootId ? quack.id : undefined)}
            >
              {quack.rootId ? "Open discussion" : `Replies (${quack.replyCount ?? 0})`}
            </a>
          )}
        </div>
        {onDelete ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit text-destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        ) : null}
        {onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            onClick={onOpen}
            aria-label={`Open post by ${name}`}
          >
            Open post
          </Button>
        ) : null}
      </div>
    </article>
  )
}
