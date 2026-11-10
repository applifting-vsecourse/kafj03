import { z } from "zod"

// Per the Applifting frontend playbook: validate every server payload with zod
// and infer types from the schema rather than auto-generating them.
export const quackUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  username: z.string(),
})

export const quackMoodSchema = z.enum(["happy", "sad", "angry", "silly"])
export type QuackMood = z.infer<typeof quackMoodSchema>

export const pollSchema = z.object({
  id: z.string(),
  question: z.string(),
  revision: z.number().int().nonnegative(),
  totalVotes: z.number().int().nonnegative(),
  myOptionId: z.string().nullable(),
  options: z
    .array(
      z.object({
        id: z.string(),
        text: z.string(),
        position: z.number().int().nonnegative(),
        votes: z.number().int().nonnegative(),
        percentage: z.number().int().min(0).max(100),
      }),
    )
    .min(2)
    .max(5),
})
export type Poll = z.infer<typeof pollSchema>

export const quackSchema = z
  .object({
    id: z.string(),
    text: z.string().nullable(),
    mood: quackMoodSchema.nullish(),
    userId: z.string().nullable(),
    createdAt: z.coerce.date(),
    user: quackUserSchema.nullable(),
    deletedAt: z.coerce.date().nullish(),
    parentId: z.string().nullish(),
    rootId: z.string().nullish(),
    replyCount: z.number().int().nonnegative().optional(),
    parent: z
      .object({
        id: z.string(),
        text: z.string().nullable(),
        deletedAt: z.coerce.date().nullable(),
        user: quackUserSchema.nullable(),
      })
      .nullish(),
    poll: pollSchema.nullish(),
  })
  .superRefine((post, ctx) => {
    const isValid = post.deletedAt
      ? post.text === null && post.userId === null && post.user === null && !post.mood && !post.poll
      : post.text !== null && post.userId !== null && post.user !== null
    if (!isValid) ctx.addIssue({ code: "custom", message: "Invalid quack lifecycle state" })
  })

export const quacksSchema = z.array(quackSchema)

export type Quack = z.infer<typeof quackSchema>

export const replyPageSchema = z.object({
  items: z.array(quackSchema),
  nextCursor: z.string().nullable(),
})
export type ReplyPage = z.infer<typeof replyPageSchema>
