// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import assert from "node:assert/strict"
import test from "node:test"
import { StoreHandle } from "@coln-project/runtime"
import { evaluateExec, evaluateQuery } from "../../src/cli/evaluation.js"
import { createStoreSnapshot } from "../../src/cli/storeFacade.js"
import { itemSchema } from "../fixtures/schema.js"

test("query evaluates against a read-only store", () => {
  const source = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = source.beginTransaction()
  transaction.add("Test.Items", [{ tag: "string", value: "one" }])
  const store = transaction.commit().takeStore()
  const snapshot = createStoreSnapshot(store)

  const result = evaluateQuery(
    snapshot,
    `store.scanTable("Test.Items").map(row => row.values[0].value)`,
  )

  assert.deepEqual(result, ["one"])
  assert.equal("beginTransaction" in snapshot, false)
})

test("exec can read a snapshot and write through its transaction", () => {
  let store = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  let transaction = store.beginTransaction()
  transaction.add("Test.Items", [{ tag: "string", value: "one" }])
  store = transaction.commit().takeStore()
  const snapshot = createStoreSnapshot(store)

  transaction = store.beginTransaction()
  evaluateExec(
    snapshot,
    transaction,
    `
      const existing = store.scanTable("Test.Items")[0].values[0]
      txn.add("Test.Items", [existing])
    `,
  )
  store = transaction.commit().takeStore()

  assert.equal(store.scanTable("Test.Items").length, 2)
})

test("exec exposes only an active add operation", async () => {
  const store = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const snapshot = createStoreSnapshot(store)
  const transaction = store.beginTransaction()
  let deferredError: unknown

  Object.assign(globalThis, {
    captureDeferredError(error: unknown) {
      deferredError = error
    },
  })
  try {
    evaluateExec(
      snapshot,
      transaction,
      `
        if ("commit" in txn || "takeStore" in txn) throw new Error("lifecycle exposed")
        queueMicrotask(() => {
          try { txn.add("Test.Items", []) }
          catch (error) { globalThis.captureDeferredError(error) }
        })
      `,
    )
    transaction.commit().takeStore()
    await Promise.resolve()
  } finally {
    Reflect.deleteProperty(globalThis, "captureDeferredError")
  }

  assert.match(String(deferredError), /no longer active/)
})

test("query and exec reject promises", () => {
  const store = createStoreSnapshot(StoreHandle.fromTheory(JSON.stringify(itemSchema)))
  assert.throws(() => evaluateQuery(store, "Promise.resolve(1)"), /synchronously/)

  const source = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = source.beginTransaction()
  assert.throws(() => evaluateExec(store, transaction, "return Promise.resolve()"), /synchronously/)
  transaction.takeStore()
})
