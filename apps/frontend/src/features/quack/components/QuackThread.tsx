import { useEffect, useState } from "react"
import { useInfiniteQuery, useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { quackQueryOptions, repliesQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { QuackForm } from "@/features/quack/components/QuackForm"
import { QuackItem } from "@/features/quack/components/QuackItem"
import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

export function QuackThread({
  id,
  reply,
  from,
  user,
}: {
  id: string
  reply?: string
  from?: string
  user?: { id: string; role?: string; defaultMood?: "happy" | "sad" | "angry" | "silly" | null }
}) {
  const detail = useQuery(quackQueryOptions(id))
  const rootId = detail.data?.rootId ?? id
  const root = useQuery({ ...quackQueryOptions(rootId), enabled: Boolean(detail.data) })
  const [targetPage, setTargetPage] = useState<string>()
  const [recipientId, setRecipientId] = useState<string>()
  const [highlight, setHighlight] = useState(reply)
  const recipient = useQuery({
    ...quackQueryOptions(recipientId ?? rootId),
    enabled: Boolean(recipientId),
  })
  const effectiveTarget = targetPage ?? reply ?? (detail.data?.rootId ? id : undefined)
  const highlighted = highlight ?? effectiveTarget
  const pages = useInfiniteQuery({
    ...repliesQueryOptions(rootId, effectiveTarget),
    enabled: Boolean(root.data),
  })
  const deletion = useDeleteQuack()
  useEffect(() => {
    if (!highlighted || !pages.data) return
    const node = document.getElementById(`quack-${highlighted}`)
    node?.scrollIntoView?.({ block: "center" })
    if (node) {
      node.tabIndex = -1
      node.focus({ preventScroll: true })
    }
  }, [highlighted, pages.data])
  const respond = (post: Quack) => {
    setRecipientId(post.id)
    requestAnimationFrame(() =>
      document.querySelector<HTMLTextAreaElement>("[data-reply-text]")?.focus(),
    )
  }
  const item = (post: Quack) => (
    <div
      key={post.id}
      className={highlighted === post.id ? "rounded-md ring-2 ring-primary" : undefined}
    >
      <QuackItem
        quack={post}
        onReply={() => respond(post)}
        onDelete={
          !post.deletedAt && (post.userId === user?.id || user?.role === "admin")
            ? () => deletion.confirmDelete(post.id)
            : undefined
        }
        isDeleting={deletion.isPending && deletion.variables === post.id}
      />
    </div>
  )
  const back = from?.startsWith("/quacks?") || from === "/quacks" ? from : "/quacks"
  if (detail.error || root.error) {
    return (
      <div role="alert">
        <p>Could not load discussion.</p>
        <Button
          variant="outline"
          onClick={() => {
            void detail.refetch()
            void root.refetch()
          }}
        >
          Retry
        </Button>
        <a href={back}>Back to quacks</a>
      </div>
    )
  }
  if (detail.isPending || root.isPending) return <p role="status">Loading discussion…</p>
  if (!root.data) return null
  const addressed = recipientId && recipient.data ? recipient.data : root.data
  return (
    <>
      <a
        className="text-sm underline"
        href={back}
      >
        Back to quacks
      </a>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">Discussion</h1>
      {item(root.data)}
      <h2 className="mt-6 text-xl font-semibold tracking-tight">
        Replies ({root.data.replyCount ?? 0})
      </h2>
      {effectiveTarget ? (
        <a
          className="text-sm underline"
          href={`/quacks/${encodeURIComponent(rootId)}`}
        >
          Start of discussion
        </a>
      ) : null}
      {pages.isPending ? <p role="status">Loading replies…</p> : null}
      {pages.error ? (
        <div role="alert">
          <p>Could not load replies.</p>
          <Button
            variant="outline"
            onClick={() => void pages.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : null}
      {pages.data?.pages.flatMap((page) => page.items).map(item)}
      {pages.isSuccess && !pages.data.pages.some((page) => page.items.length) ? (
        <p className="py-4 text-muted-foreground">No replies yet. Start the discussion.</p>
      ) : null}
      {pages.hasNextPage ? (
        <Button
          variant="outline"
          disabled={pages.isFetchingNextPage}
          onClick={() => void pages.fetchNextPage()}
        >
          {pages.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      ) : null}
      {deletion.error ? (
        <p
          role="alert"
          className="text-destructive"
        >
          Could not delete the post. Please try again.
        </p>
      ) : null}
      <section
        className="mt-6 border-t border-border pt-4"
        aria-label="Write a reply"
      >
        <p className="mb-2 text-sm text-muted-foreground">
          {addressed.deletedAt
            ? "Reply to a deleted quack"
            : `Reply to ${addressed.user?.name}: ${addressed.text?.slice(0, 100)}`}
        </p>
        {recipientId && recipientId !== rootId ? (
          <Button
            variant="ghost"
            onClick={() => setRecipientId(undefined)}
          >
            Reply to original quack
          </Button>
        ) : null}
        {recipient.isError && recipientId ? (
          <p role="alert">
            Could not verify the reply target.{" "}
            <Button
              variant="outline"
              onClick={() => void recipient.refetch()}
            >
              Retry
            </Button>
          </p>
        ) : null}
        <QuackForm
          defaultMood={user?.defaultMood ?? ""}
          parentId={recipientId ?? rootId}
          onCreated={(createdId) => {
            setRecipientId(undefined)
            setTargetPage(createdId)
            setHighlight(createdId)
          }}
        />
      </section>
    </>
  )
}
