import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { HTTPError } from "ky"
import { Tabs } from "radix-ui"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { recordSearchUsage } from "@/features/quack/api/searchUsage"
import { QuackList } from "@/features/quack/components/QuackList"
import { useDeleteQuack } from "@/features/quack/hooks/useDeleteQuack"

export function QuackFeed({
  currentUserId,
  currentUserRole,
}: {
  currentUserId?: string
  currentUserRole?: string
}) {
  const params = new URLSearchParams(window.location.search)
  const [scope, setScope] = useState<"all" | "mine">(
    params.get("scope") === "mine" ? "mine" : "all",
  )
  const [input, setInput] = useState(params.get("q") ?? "")
  const [query, setQuery] = useState(input.trim())
  const normalizedInput = input.trim().replace(/\s+/g, " ")
  const result = useQuery(quacksQueryOptions(normalizedInput ? query : "", scope))
  const deletion = useDeleteQuack()
  const recordedSearch = useRef("")
  useEffect(() => {
    recordSearchUsage("feed")
  }, [])
  useEffect(() => {
    const timer = setTimeout(() => setQuery(normalizedInput), 300)
    return () => clearTimeout(timer)
  }, [normalizedInput])
  useEffect(() => {
    const search = new URLSearchParams({
      ...(query ? { q: query } : {}),
      ...(scope === "mine" ? { scope } : {}),
    })
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${search.size ? `?${search}` : ""}`,
    )
  }, [query, scope])
  const isWaiting = Boolean(normalizedInput) && normalizedInput !== query
  useEffect(() => {
    if (!normalizedInput) recordedSearch.current = ""
    if (
      !isWaiting &&
      query &&
      normalizedInput &&
      result.isSuccess &&
      recordedSearch.current !== query
    ) {
      recordSearchUsage("search")
      recordedSearch.current = query
    }
  }, [normalizedInput, query, isWaiting, result.isSuccess])
  const posts = (result.data ?? [])
    .filter(
      (p) => !p.deletedAt || (scope === "all" && !query && !p.parentId && (p.replyCount ?? 0) > 0),
    )
    .filter((p) => scope === "all" || p.userId === currentUserId)
  return (
    <Tabs.Root
      value={scope}
      onValueChange={(value) => setScope(value as "all" | "mine")}
    >
      <Tabs.List
        aria-label="Post filter"
        className="mb-4 flex gap-2"
      >
        {(
          [
            ["all", "All"],
            ["mine", "Mine"],
          ] as const
        ).map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            asChild
          >
            <Button variant={scope === value ? "secondary" : "outline"}>{label}</Button>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={scope}>
        {deletion.error ? (
          <p
            role="alert"
            className="mb-4 text-destructive"
          >
            {deletion.error instanceof HTTPError && deletion.error.response.status === 403
              ? "You do not have permission to delete this post."
              : "Could not delete the post. Please try again."}
          </p>
        ) : null}
        <div className="mb-4 flex flex-col gap-2">
          <label
            htmlFor="quack-search"
            className="text-sm font-medium"
          >
            Search posts
          </label>
          <Input
            id="quack-search"
            type="search"
            value={input}
            placeholder="For example, Peter trip"
            onChange={(event) => setInput(event.target.value)}
          />
        </div>
        {scope === "mine" &&
        !normalizedInput &&
        !result.isFetching &&
        !result.error &&
        !posts.length ? (
          <Button
            variant="link"
            onClick={() =>
              document.querySelector<HTMLTextAreaElement>("[data-new-quack-text]")?.focus()
            }
          >
            Write your first post
          </Button>
        ) : null}
        <QuackList
          returnTo={`/quacks?${new URLSearchParams({ ...(query ? { q: query } : {}), ...(scope === "mine" ? { scope } : {}) })}`}
          quacks={isWaiting ? [] : posts}
          isLoading={isWaiting || result.isPending}
          error={isWaiting ? undefined : (result.error ?? undefined)}
          onReload={() => void result.refetch()}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onDelete={deletion.confirmDelete}
          deletingId={deletion.isPending ? deletion.variables : undefined}
          emptyMessage={
            normalizedInput
              ? "No posts match your search"
              : scope === "mine"
                ? "You haven't posted yet."
                : undefined
          }
        />
      </Tabs.Content>
    </Tabs.Root>
  )
}
