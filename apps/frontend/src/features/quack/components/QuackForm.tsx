import { zodResolver } from "@hookform/resolvers/zod"
import { Angry, Frown, Laugh, Loader2, Smile } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { z } from "zod"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { quackMoodSchema } from "@/features/quack/api/quackSchemas"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280
const MOOD_ICONS = { happy: Smile, sad: Frown, angry: Angry, silly: Laugh }

const schema = z.object({
  mood: z.union([z.literal(""), quackMoodSchema]),
  text: z
    .string()
    .trim()
    .min(1, "Write something first")
    .max(MAX_LENGTH, `Keep it under ${MAX_LENGTH} characters`),
})

type FormValues = z.infer<typeof schema>

type QuackFormProps = { className?: string }

export function QuackForm({ className }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { text: "", mood: "" },
  })

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      { text: values.text, ...(values.mood ? { mood: values.mood } : {}) },
      { onSuccess: () => form.reset() },
    )
  }

  return (
    <Form {...form}>
      <form
        noValidate
        onSubmit={form.handleSubmit(handleSubmit)}
        className={cn("space-y-3", className)}
      >
        {addQuack.error ? (
          <Alert variant="destructive">
            <AlertDescription>{addQuack.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <div className="flex items-start gap-3">
          <FormField
            control={form.control}
            name="text"
            render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormLabel>New quack</FormLabel>
                <FormControl>
                  <Textarea
                    rows={3}
                    placeholder="Quack something..."
                    disabled={addQuack.isPending}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="mood"
            render={({ field }) => (
              <FormItem>
                <fieldset disabled={addQuack.isPending}>
                  <legend className="mb-2 text-sm font-medium">Mood (optional)</legend>
                  <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
                    {quackMoodSchema.options.map((mood) => {
                      const MoodIcon = MOOD_ICONS[mood]
                      return (
                        <Button
                          key={mood}
                          type="button"
                          size="icon"
                          variant={field.value === mood ? "secondary" : "outline"}
                          className={cn(field.value === mood && "ring-2 ring-primary")}
                          aria-label={mood}
                          aria-pressed={field.value === mood}
                          title={mood}
                          onClick={() => field.onChange(field.value === mood ? "" : mood)}
                          onBlur={field.onBlur}
                        >
                          <MoodIcon
                            aria-hidden="true"
                            className="size-5"
                          />
                        </Button>
                      )
                    })}
                  </div>
                </fieldset>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex items-center justify-end gap-3">
          <span
            className={cn(
              "text-sm",
              length > MAX_LENGTH ? "text-destructive" : "text-muted-foreground",
            )}
          >
            {length}/{MAX_LENGTH}
          </span>
          <Button
            type="submit"
            size="sm"
            disabled={addQuack.isPending}
          >
            {addQuack.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Quack
          </Button>
        </div>
      </form>
    </Form>
  )
}
