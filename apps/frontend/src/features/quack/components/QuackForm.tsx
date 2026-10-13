import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Angry, Frown, Laugh, Loader2, Smile } from "lucide-react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"

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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

import { quackMoodSchema } from "@/features/quack/api/quackSchemas"
import { quackFormSchema, type QuackFormValues } from "@/features/quack/components/quackFormSchema"
import { useAddQuack } from "@/features/quack/hooks/useAddQuack"

// Mirrors the server-side DTO (MaxLength(280)) so the user is told before
// the request is made — the server still validates independently.
const MAX_LENGTH = 280
const MOOD_ICONS = { happy: Smile, sad: Frown, angry: Angry, silly: Laugh }

type FormValues = QuackFormValues

type QuackFormProps = { className?: string; defaultMood?: FormValues["mood"] }

export function QuackForm({ className, defaultMood = "" }: QuackFormProps) {
  const addQuack = useAddQuack()
  const form = useForm<FormValues>({
    resolver: zodResolver(quackFormSchema),
    defaultValues: {
      text: "",
      mood: defaultMood,
      pollEnabled: false,
      question: "",
      options: [{ text: "" }, { text: "" }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "options" })
  const isPollEnabled = useWatch({ control: form.control, name: "pollEnabled" })

  useEffect(() => {
    if (!form.getFieldState("mood").isDirty) form.setValue("mood", defaultMood)
  }, [defaultMood, form])

  const text = useWatch({ control: form.control, name: "text" })
  const length = text?.length ?? 0

  const handleSubmit = (values: FormValues) => {
    addQuack.mutate(
      {
        text: values.text,
        ...(values.mood ? { mood: values.mood } : {}),
        ...(values.pollEnabled
          ? {
              poll: {
                question: values.question,
                options: values.options.map((option) => option.text),
              },
            }
          : {}),
      },
      {
        onSuccess: () =>
          form.reset({
            text: "",
            mood: defaultMood,
            pollEnabled: false,
            question: "",
            options: [{ text: "" }, { text: "" }],
          }),
      },
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

        <div className="space-y-3 border-t border-border pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addQuack.isPending}
            aria-expanded={isPollEnabled}
            onClick={() => {
              form.setValue("pollEnabled", !isPollEnabled, { shouldDirty: true })
              form.clearErrors(["question", "options"])
            }}
          >
            {isPollEnabled ? "Remove poll" : "Add poll"}
          </Button>
          {isPollEnabled ? (
            <fieldset
              className="space-y-3"
              disabled={addQuack.isPending}
            >
              <legend className="mb-2 text-sm font-medium">Poll</legend>
              <FormField
                control={form.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Question</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Where should we have lunch?"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {fields.map((option, index) => (
                <div
                  key={option.id}
                  className="flex items-start gap-3"
                >
                  <FormField
                    control={form.control}
                    name={`options.${index}.text`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormLabel>Option {index + 1}</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-6"
                    disabled={fields.length <= 2}
                    aria-label={`Remove option ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              {form.formState.errors.options?.root?.message ? (
                <p
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {form.formState.errors.options.root.message}
                </p>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={fields.length >= 5}
                onClick={() => append({ text: "" })}
              >
                Add option
              </Button>
              <p className="text-sm text-muted-foreground">
                2–5 options, up to 100 characters each. The question and options cannot be edited
                after posting.
              </p>
            </fieldset>
          ) : null}
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
