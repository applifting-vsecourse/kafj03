import { QueryClient } from "@tanstack/react-query"
import { describe, expect, it } from "vitest"

import { optimisticVote, storePoll } from "./pollState"
import { quackKeys } from "./quackKeys"
import type { Poll, Quack } from "./quackSchemas"

const poll: Poll = {
  id: "p",
  question: "Q",
  revision: 2,
  totalVotes: 3,
  myOptionId: "a",
  options: [
    { id: "a", text: "A", position: 0, votes: 2, percentage: 67 },
    { id: "b", text: "B", position: 1, votes: 1, percentage: 33 },
  ],
}

describe("poll state", () => {
  it("moves a vote and recomputes rounded percentages without mutating confirmed data", () => {
    const next = optimisticVote(poll, "b")
    expect(next.totalVotes).toBe(3)
    expect(next.options.map((option) => [option.votes, option.percentage])).toEqual([
      [1, 33],
      [2, 67],
    ])
    expect(poll.options[0]?.votes).toBe(2)
  })
  it("ignores an older response in every cached view", () => {
    const client = new QueryClient()
    const post: Quack = {
      id: "q",
      text: "Q",
      userId: "u",
      createdAt: new Date(),
      user: { id: "u", name: "Duck", username: "duck" },
      poll,
    }
    client.setQueryData([...quackKeys.lists(), ""], [post])
    client.setQueryData(quackKeys.detail("q"), post)
    storePoll(client, "q", poll)
    storePoll(client, "q", { ...poll, revision: 1, totalVotes: 0 })
    expect(client.getQueryData(quackKeys.poll("q"))).toEqual(poll)
    expect(client.getQueryData<Quack>(quackKeys.detail("q"))?.poll).toEqual(poll)
    expect(client.getQueryData<Quack[]>([...quackKeys.lists(), ""])?.[0]?.poll).toEqual(poll)
    client.clear()
  })
})
