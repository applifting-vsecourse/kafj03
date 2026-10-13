import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

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
import { api, HTTPError } from "@/lib/api-client"
import { authKeys } from "@/lib/auth-keys"
import { quackKeys } from "@/lib/quack-keys"

import type { Session, SessionUser } from "@/features/auth/api/authSessionQueryOptions"

const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])

export const settingsSchema = z.object({
  username: z
    .string()
    .min(3, "Use 3–30 characters")
    .max(30, "Use 3–30 characters")
    .regex(/^[a-zA-Z0-9._]+$/, "Use letters, numbers, dots and underscores"),
  name: z.string().trim().min(1, "Display name is required"),
  bio: z.string().max(160, "Bio must be at most 160 characters"),
  defaultMood: z.union([z.literal(""), quackMoodSchema]),
})
type Values = z.infer<typeof settingsSchema>
const responseSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
  bio: z.string().nullable(),
  defaultMood: quackMoodSchema.nullable(),
})

export function SettingsForm({ user }: { user: SessionUser }) {
  const queryClient = useQueryClient()
  const savedValues = (): Values => ({
    username: user.username,
    name: user.name,
    bio: user.bio ?? "",
    defaultMood: user.defaultMood ?? "",
  })
  const form = useForm<Values>({
    resolver: zodResolver(settingsSchema),
    defaultValues: savedValues(),
  })
  const mutation = useMutation({
    mutationFn: async (values: Values) =>
      responseSchema.parse(
        await api
          .patch("settings", { json: { ...values, defaultMood: values.defaultMood || null } })
          .json(),
      ),
    onMutate: async () => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: authKeys.session() }),
        queryClient.cancelQueries({ queryKey: quackKeys.all() }),
      ])
    },
    onSuccess: (updated) => {
      queryClient.setQueryData<Session>(authKeys.session(), (session) =>
        session ? { user: { ...session.user, ...updated } } : session,
      )
      form.reset({ ...updated, bio: updated.bio ?? "", defaultMood: updated.defaultMood ?? "" })
      queryClient.setQueriesData<{ user: { id: string; name: string; username: string } }[]>(
        { queryKey: quackKeys.lists() },
        (quacks) =>
          quacks?.map((quack) =>
            quack.user.id === updated.id
              ? {
                  ...quack,
                  user: { ...quack.user, name: updated.name, username: updated.username },
                }
              : quack,
          ),
      )
      void queryClient.invalidateQueries({ queryKey: quackKeys.all() })
      toast.success("Settings saved")
    },
    onError: (error) => {
      if (error instanceof HTTPError && error.response.status === 409) {
        form.setError(
          "username",
          { message: "This username is already taken" },
          { shouldFocus: true },
        )
      } else form.setError("root", { message: error.message })
    },
  })
  return (
    <Form {...form}>
      <form
        className="space-y-5"
        noValidate
        onSubmit={form.handleSubmit((values) => {
          if (!form.formState.isDirty || mutation.isPending) return
          form.clearErrors()
          mutation.mutate(values)
        })}
      >
        <fieldset
          disabled={mutation.isPending}
          className="space-y-5"
        >
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="username"
                  />
                </FormControl>
                <p className="text-sm text-muted-foreground">
                  3–30 characters: letters, numbers, dots and underscores.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display name</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    autoComplete="name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Bio (optional)</FormLabel>
                <FormControl>
                  <Textarea {...field} />
                </FormControl>
                <p className="text-sm text-muted-foreground">{field.value.length}/160</p>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="defaultMood"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Default mood for new posts</FormLabel>
                <FormControl>
                  <select
                    {...field}
                    className="h-10 w-full rounded-md border border-input bg-background px-3"
                  >
                    <option value="">None</option>
                    {quackMoodSchema.options.map((mood) => (
                      <option
                        key={mood}
                        value={mood}
                      >
                        {mood}
                      </option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {form.formState.errors.root ? (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {form.formState.errors.root.message}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button
              type="submit"
              aria-disabled={!form.formState.isDirty}
              className="aria-disabled:opacity-50"
            >
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset(savedValues())}
            >
              Discard changes
            </Button>
          </div>
        </fieldset>
      </form>
    </Form>
  )
}
