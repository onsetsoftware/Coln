// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { flushSync } from "svelte"
import { describe, expect, test, vi } from "vitest"
import type { ColnChange, ColnDocument, ColnHandle as RepoColnHandle } from "@coln-project/repo"
import { ColnHandle } from "../src/lib/coln-handle.svelte.ts"
import * as GraphRealm from "../src/generated/GraphRealm.ts"
import { observe } from "./observe.svelte.ts"

type GraphHandle = RepoColnHandle<typeof GraphRealm>
type GraphDocument = ColnDocument<typeof GraphRealm>
type Change = ColnChange<typeof GraphRealm>
type Event = "change" | "heads-changed"

describe("ColnHandle", () => {
  test("returns the current document", () => {
    const handle = new FakeHandle()
    const colnHandle = new ColnHandle(handle as unknown as GraphHandle)

    expect(colnHandle.state).toBe(handle.document)

    handle.document = fakeDocument()
    expect(colnHandle.state).toBe(handle.document)
  })

  test("delegates changes to the handle", () => {
    const handle = new FakeHandle()
    const colnHandle = new ColnHandle(handle as unknown as GraphHandle)
    const change = vi.fn<Change>()

    colnHandle.change(change)

    expect(handle.change).toHaveBeenCalledOnce()
    expect(handle.change).toHaveBeenCalledWith(change)
  })

  test("reacts to changes and releases its listener", async () => {
    const handle = new FakeHandle()
    const colnHandle = new ColnHandle(handle as unknown as GraphHandle)
    let observed: GraphDocument | undefined
    const stop = observe(() => colnHandle.state, state => {
      observed = state
    })
    flushSync()

    expect(observed).toBe(handle.document)
    expect(handle.listenerCount("change")).toBe(1)
    expect(handle.listenerCount("heads-changed")).toBe(0)

    handle.document = fakeDocument()
    handle.emit("change")
    flushSync()
    expect(observed).toBe(handle.document)

    stop()
    await Promise.resolve()
    expect(handle.listenerCount("change")).toBe(0)
  })
})

class FakeHandle {
  document = fakeDocument()
  readonly change = vi.fn((_change: Change) => {})
  readonly #listeners = new Map<Event, Set<() => void>>()

  doc(): GraphDocument {
    return this.document
  }

  on(event: Event, listener: () => void): void {
    const listeners = this.#listeners.get(event) ?? new Set()
    listeners.add(listener)
    this.#listeners.set(event, listeners)
  }

  off(event: Event, listener: () => void): void {
    this.#listeners.get(event)?.delete(listener)
  }

  emit(event: Event): void {
    for (const listener of this.#listeners.get(event) ?? []) listener()
  }

  listenerCount(event: Event): number {
    return this.#listeners.get(event)?.size ?? 0
  }
}

function fakeDocument(): GraphDocument {
  return {} as GraphDocument
}
