import { Loader2, RefreshCw } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

import type { Quack } from "@/features/quack/api/quackSchemas"
import { QuackItem } from "@/features/quack/components/QuackItem"

type QuackListProps = {
  quacks: Quack[]
  isLoading?: boolean
  error?: Error
  onReload?: () => void
  emptyMessage?: string
  onOpen?: (id: string) => void
}

export function QuackList({
  quacks,
  isLoading,
  error,
  onReload,
  emptyMessage,
  onOpen,
}: QuackListProps) {
  return (
    <div className="flex flex-col">
      {isLoading ? (
        <div
          role="status"
          className="flex items-center justify-center gap-2 py-8 text-muted-foreground"
        >
          <span>Loading posts…</span>
          <Loader2 className="size-5 animate-spin" />
        </div>
      ) : null}

      {error ? (
        <Alert
          variant="destructive"
          className="mb-4"
        >
          <AlertTitle>Couldn&apos;t load quacks</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>{error.message}</span>
            {onReload ? (
              <Button
                variant="outline"
                size="sm"
                onClick={onReload}
              >
                <RefreshCw className="size-4" />
                Reload
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {!isLoading && !error && quacks.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {emptyMessage ?? "No quacks yet. Post the first one."}
        </p>
      ) : null}

      {quacks.map((quack) => (
        <QuackItem
          key={quack.id}
          quack={quack}
          onOpen={onOpen ? () => onOpen(quack.id) : undefined}
        />
      ))}
    </div>
  )
}
