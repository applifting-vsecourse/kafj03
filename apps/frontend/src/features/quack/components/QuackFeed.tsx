import { useEffect, useRef, useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Tabs } from "radix-ui"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { deleteQuack } from "@/features/quack/api/deleteQuack"
import { quackKeys } from "@/features/quack/api/quackKeys"
import type { Quack } from "@/features/quack/api/quackSchemas"
import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { recordSearchUsage } from "@/features/quack/api/searchUsage"
import { QuackList } from "@/features/quack/components/QuackList"

export function QuackFeed({ currentUserId }: { currentUserId?: string }) {
  const client = useQueryClient()
  const [scope, setScope] = useState<"all" | "mine">("all")
  const deletion = useMutation({
    mutationFn: deleteQuack,
    onSuccess: async (_, id) => {
      await client.cancelQueries({ queryKey: quackKeys.all() })
      client.setQueriesData<Quack[]>({ queryKey: quackKeys.lists() }, (posts) =>
        posts?.filter((post) => post.id !== id),
      )
      client.removeQueries({ queryKey: quackKeys.detail(id) })
      await client.invalidateQueries({ queryKey: quackKeys.lists() })
    },
  })
  const handleDelete = (id: string) => {
    if (window.confirm("Opravdu chcete smazat tento příspěvek?")) deletion.mutate(id)
  }
  const deleteProps = {
    currentUserId,
    onDelete: handleDelete,
    deletingId: deletion.isPending ? deletion.variables : undefined,
  }
  const [input, setInput] = useState("")
  const [query, setQuery] = useState("")
  const normalizedInput = input.trim().replace(/\s+/g, " ")
  const quacksQuery = useQuery(quacksQueryOptions(normalizedInput ? query : ""))
  const recordedSearch = useRef("")
  const [openedId, setOpenedId] = useState<string | null>(null)

  useEffect(() => {
    recordSearchUsage("feed")
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => {
      setQuery(normalizedInput)
      setOpenedId(null)
    }, 300)
    return () => clearTimeout(timeout)
  }, [normalizedInput])

  const isWaiting = Boolean(normalizedInput) && normalizedInput !== query
  useEffect(() => {
    if (!normalizedInput) recordedSearch.current = ""
    if (
      !isWaiting &&
      query &&
      normalizedInput &&
      quacksQuery.isSuccess &&
      recordedSearch.current !== query
    ) {
      recordSearchUsage("search")
      recordedSearch.current = query
    }
  }, [normalizedInput, query, isWaiting, quacksQuery.isSuccess])

  const isSearching = Boolean(normalizedInput)
  const posts = (quacksQuery.data ?? []).filter(
    (post) => scope === "all" || post.userId === currentUserId,
  )
  const selected = posts.find((quack) => quack.id === openedId)

  return (
    <Tabs.Root
      value={scope}
      onValueChange={(value) => {
        setScope(value as "all" | "mine")
        setOpenedId(null)
      }}
    >
      <Tabs.List
        aria-label="Filtr příspěvků"
        className="mb-4 flex gap-2"
      >
        {(
          [
            ["all", "Vše"],
            ["mine", "Moje"],
          ] as const
        ).map(([value, label]) => (
          <Tabs.Trigger
            key={value}
            value={value}
            asChild
          >
            <Button variant={scope === value ? "default" : "outline"}>{label}</Button>
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={scope}>
        {deletion.error ? (
          <p
            role="alert"
            className="mb-4 text-destructive"
          >
            Příspěvek se nepodařilo smazat. Zkuste to znovu.
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
        {selected && isSearching && !isWaiting ? (
          <section
            aria-label="Opened post"
            className="mb-4 border-b border-border pb-4"
          >
            <QuackList
              quacks={[selected]}
              {...deleteProps}
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setOpenedId(null)}
            >
              Close post
            </Button>
          </section>
        ) : null}
        {scope === "mine" &&
        !isSearching &&
        !quacksQuery.isFetching &&
        !quacksQuery.error &&
        posts.length === 0 ? (
          <Button
            variant="link"
            onClick={() =>
              document.querySelector<HTMLTextAreaElement>("[data-new-quack-text]")?.focus()
            }
          >
            Napsat první příspěvek
          </Button>
        ) : null}
        <QuackList
          {...deleteProps}
          quacks={isWaiting ? [] : posts}
          isLoading={isWaiting || quacksQuery.isFetching}
          error={isWaiting ? undefined : (quacksQuery.error ?? undefined)}
          onReload={() => void quacksQuery.refetch()}
          emptyMessage={
            isSearching
              ? "No posts match your search"
              : scope === "mine"
                ? "Zatím nemáte žádné příspěvky."
                : undefined
          }
          onOpen={
            isSearching && !isWaiting
              ? (id) => {
                  setOpenedId(id)
                  recordSearchUsage("open")
                }
              : undefined
          }
        />
      </Tabs.Content>
    </Tabs.Root>
  )
}
