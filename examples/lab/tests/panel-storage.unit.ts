// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  loadGraphPanel,
  saveGraphPanel,
} from "../src/tools/graph/panel-storage.ts"

const values = new Map<string, string>()

beforeEach(() => {
  values.clear()
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  })
})

afterEach(() => vi.unstubAllGlobals())

describe("graph panel storage", () => {
  it("defaults to the graph panel", () => {
    expect(loadGraphPanel()).toBe("graph")
  })

  it("persists the active panel", () => {
    saveGraphPanel("repl")
    expect(loadGraphPanel()).toBe("repl")
    saveGraphPanel("graph")
    expect(loadGraphPanel()).toBe("graph")
  })

  it("ignores invalid stored values", () => {
    values.set("coln-lab-graph:active-panel", "bogus")
    expect(loadGraphPanel()).toBe("graph")
  })

  it("tolerates unavailable storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("unavailable") },
      setItem: () => { throw new Error("unavailable") },
    })
    expect(loadGraphPanel()).toBe("graph")
    expect(() => saveGraphPanel("repl")).not.toThrow()
  })
})
