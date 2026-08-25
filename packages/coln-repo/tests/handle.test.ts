// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import assert from "node:assert/strict"
import { afterEach, beforeEach, test } from "node:test"
import type { Value } from "@coln-project/runtime"
import { colnDocType, create, find } from "../src/index"
import schema from "./generated/GraphRealm.json" with { type: "json" }
import * as GraphRealm from "./generated/GraphRealm"
import { createTestRepoPair, waitForChange, type TestRepoPair } from "./helpers/TestRepoPair"

let repos: TestRepoPair

beforeEach(async () => {
  repos = await createTestRepoPair()
})

afterEach(async () => {
  await repos.shutdown()
})

test("document matches expected structure", () => {
  const colnHandle = create(repos.source, GraphRealm)
  const rawHandle = repos.source.create<typeof colnDocType>(schema, colnDocType)

  assert.deepEqual(Object.keys(colnHandle.doc()).sort(), ["realm", "store"])
  assert.deepEqual(Object.keys(rawHandle.doc()), ["store"])
  assert.equal(colnHandle.heads().length, 1)
})

test("document can be updated and changes are reflected", () => {
  const colnHandle = create(repos.source, GraphRealm)

  let v1!: Value, v2!: Value, e1!: Value

  colnHandle.change(tx => {
    v1 = tx.root.V.add()
    v2 = tx.root.V.add()
    e1 = tx.root.E(v1)(v2).add()
  })

  const doc = colnHandle.doc()

  assert(doc.realm.root.V.has(v1))
  assert(doc.realm.root.V.has(v2))
  assert(doc.realm.root.E(v1)(v2).has(e1))
})

test("changes sync between handles", async () => {
  const handle = create(repos.source, GraphRealm)
  const replica = await find(repos.replica, handle.url, GraphRealm)
  let v1!: Value, v2!: Value, e1!: Value

  const changed = waitForChange(replica)
  handle.change(tx => {
    v1 = tx.root.V.add()
    v2 = tx.root.V.add()
  })
  await changed

  assert(replica.doc().realm.root.V.has(v1))
  assert(replica.doc().realm.root.V.has(v2))

  const changedBack = waitForChange(handle)
  replica.change(tx => {
    e1 = tx.root.E(v1)(v2).add()
  })
  await changedBack

  assert(handle.doc().realm.root.E(v1)(v2).has(e1))
})

test("changes sync between handles with raw ColnDocType", async () => {
  const handle = create(repos.source, GraphRealm)
  const replica = await repos.replica.find(handle.url, colnDocType)
  let v1!: Value, v2!: Value, e1!: Value

  const changed = waitForChange(replica)
  handle.change(tx => {
    v1 = tx.root.V.add()
    v2 = tx.root.V.add()
  })
  await changed

  assert.deepEqual(
    replica
      .doc()
      .store.scanTable("GraphRealm.V")
      .map(row => row.rowId),
    [v1, v2],
  )

  assert(replica.doc().store.scanTable("GraphRealm.V").length === 2)

  const changedBack = waitForChange(handle)
  replica.change(tx => {
    e1 = tx.add("GraphRealm.E", [v1, v2])
  })
  await changedBack

  assert(handle.doc().realm.root.E(v1)(v2).has(e1))
})
