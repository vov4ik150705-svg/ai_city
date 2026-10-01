import { describe, expect, it } from "vitest"
import { canonical, type Json } from "@corporator/contentpack"
import { commandTemplate } from "@corporator/protocol"
import { createLiveAdapter } from "../src/hud/liveAdapter.ts"
import { emptySnapshot } from "../src/index.ts"

describe("M8 client assign and train", () => {
  it("agent_card_train_posts_target", async () => {
    let posted: { readonly [key: string]: Json } | undefined
    const adapter = createLiveAdapter({
      origin: "http://adapter.test",
      cityId: "a",
      sessionId: "s",
      commandTemplate,
      post: async () => {
        throw new Error("post")
      },
      cityTime: () => 7n,
      nextSeq: () => 1n,
      fetchSnapshot: async () => emptySnapshot(),
      postCommand: async (args) => {
        posted = args.extra
        return { status: 200, body: canonical({ city_time: 7n }) }
      },
    })
    const assign = await adapter.dispatch({ kind: "assign", agentId: "h1", buildingId: "workshop" })
    expect(assign.kind).toBe("applied")
    expect(posted).toEqual({ agent_id: "h1", building_id: "workshop" })
    const train = await adapter.dispatch({
      kind: "set_objective",
      agentId: "h1",
      objective: "train",
      trainTarget: "h2",
    })
    expect(train.kind).toBe("applied")
    expect(posted).toEqual({ agent_id: "h1", objective: "train", train_target: "h2" })
  })
})
