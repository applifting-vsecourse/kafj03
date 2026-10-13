import { describe, expect, it } from "vitest"

import { quackFormSchema } from "./quackFormSchema"

const values = {
  text: "Lunch",
  mood: "",
  pollEnabled: true,
  question: "Where?",
  options: [{ text: "Pizza" }, { text: "Soup" }],
}

describe("poll form limits", () => {
  it("accepts maximum lengths and five distinct options", () => {
    expect(
      quackFormSchema.safeParse({
        ...values,
        question: "Q".repeat(280),
        options: Array.from({ length: 5 }, (_, i) => ({ text: String(i).repeat(100) })),
      }).success,
    ).toBe(true)
  })
  it.each([
    { question: "Q".repeat(281) },
    { question: "  " },
    { options: [{ text: "A" }] },
    { options: Array.from({ length: 6 }, (_, i) => ({ text: String(i) })) },
    { options: [{ text: "A" }, { text: "B".repeat(101) }] },
    { options: [{ text: "A" }, { text: "  " }] },
    { options: [{ text: " Pizza " }, { text: "pizza" }] },
  ])("rejects invalid enabled polls", (overrides) => {
    expect(quackFormSchema.safeParse({ ...values, ...overrides }).success).toBe(false)
  })
  it("still requires post text when a poll is present", () => {
    expect(quackFormSchema.safeParse({ ...values, text: " " }).success).toBe(false)
  })
})
