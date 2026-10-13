import { describe, expect, it } from "vitest"

import { quackSchema } from "./quackSchemas"

const post = {
  id: "q",
  text: "Lunch",
  userId: "u",
  createdAt: "2026-10-13T12:00:00Z",
  user: { id: "u", name: "Duck", username: "duck" },
}
const poll = {
  id: "p",
  question: "Where?",
  revision: 1,
  totalVotes: 1,
  myOptionId: "a",
  options: [
    { id: "a", text: "Pizza", position: 0, votes: 1, percentage: 100 },
    { id: "b", text: "Soup", position: 1, votes: 0, percentage: 0 },
  ],
}

describe("quack response schema", () => {
  it("preserves poll results and the viewer's choice", () => {
    expect(quackSchema.parse({ ...post, poll }).poll).toEqual(poll)
  })
  it("supports plain posts and existing payloads", () => {
    expect(quackSchema.parse({ ...post, poll: null }).poll).toBeNull()
    expect(quackSchema.parse(post).poll).toBeUndefined()
  })
  it.each([
    { ...poll, totalVotes: -1 },
    { ...poll, myOptionId: 12 },
    { ...poll, revision: 0.5 },
  ])("rejects invalid poll data", (invalid) => {
    expect(quackSchema.safeParse({ ...post, poll: invalid }).success).toBe(false)
  })
})
