import { useEffect, useRef, useState } from "react"
import { useQuery } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

import { quacksQueryOptions } from "@/features/quack/api/quacksQueryOptions"
import { recordSearchUsage } from "@/features/quack/api/searchUsage"
import { QuackList } from "@/features/quack/components/QuackList"

export function QuackFeed() {
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
  const selected = quacksQuery.data?.find((quack) => quack.id === openedId)

  return (
    <>
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
          <QuackList quacks={[selected]} />
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
      <QuackList
        quacks={isWaiting ? [] : (quacksQuery.data ?? [])}
        isLoading={isWaiting || quacksQuery.isFetching}
        error={isWaiting ? undefined : (quacksQuery.error ?? undefined)}
        onReload={() => void quacksQuery.refetch()}
        emptyMessage={isSearching ? "No posts match your search" : undefined}
        onOpen={
          isSearching && !isWaiting
            ? (id) => {
                setOpenedId(id)
                recordSearchUsage("open")
              }
            : undefined
        }
      />
    </>
  )
}
