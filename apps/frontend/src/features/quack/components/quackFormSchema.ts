import { z } from "zod"

import { quackMoodSchema } from "@/features/quack/api/quackSchemas"

export const quackFormSchema = z
  .object({
    mood: z.union([z.literal(""), quackMoodSchema]),
    text: z
      .string()
      .trim()
      .min(1, "Write something first")
      .max(280, "Keep it under 280 characters"),
    pollEnabled: z.boolean(),
    question: z.string().trim(),
    options: z.array(z.object({ text: z.string().trim() })),
  })
  .superRefine((values, ctx) => {
    if (!values.pollEnabled) return
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message })
    if (!values.question) issue(["question"], "Enter a question")
    if (values.question.length > 280) issue(["question"], "Keep it under 280 characters")
    if (values.options.length < 2 || values.options.length > 5) {
      issue(["options", "root"], "Add between 2 and 5 options")
    }
    const seen = new Set<string>()
    values.options.forEach((option, index) => {
      if (!option.text) issue(["options", index, "text"], "Enter an option")
      if (option.text.length > 100) {
        issue(["options", index, "text"], "Keep it under 100 characters")
      }
      const normalized = option.text.toLowerCase()
      if (option.text && seen.has(normalized)) {
        issue(["options", index, "text"], "Options must be different")
      }
      seen.add(normalized)
    })
  })

export type QuackFormValues = z.infer<typeof quackFormSchema>
