// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import assert from "node:assert/strict"
import test from "node:test"
import { StoreHandle } from "@coln-project/runtime"
import { evaluateExec, evaluateQuery } from "../../src/cli/evaluation.js"
import { createStoreFacade } from "../../src/cli/storeFacade.js"
import { itemSchema } from "../fixtures/schema.js"

test("query evaluates against a read-only store", () => {
  const source = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = source.beginTransaction()
  transaction.add("Test.Items", [{ tag: "string", value: "one" }])
  const store = transaction.commit().takeStore()
  const facade = createStoreFacade(store)

  const result = evaluateQuery(
    facade,
    `store.scanTable("Test.Items").map(row => row.values[0].value)`,
  )

  assert.deepEqual(result, ["one"])
  assert.equal("beginTransaction" in facade, false)
})

test("exec writes through its transaction", () => {
  let store = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = store.beginTransaction()

  evaluateExec(transaction, `txn.add("Test.Items", [{ tag: "string", value: "one" }])`)
  store = transaction.commit().takeStore()

  assert.equal(store.scanTable("Test.Items").length, 1)
})

test("exec exposes only an active add operation", async () => {
  const store = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = store.beginTransaction()
  let deferredError: unknown

  Object.assign(globalThis, {
    captureDeferredError(error: unknown) {
      deferredError = error
    },
  })
  try {
    evaluateExec(
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
  const store = createStoreFacade(StoreHandle.fromTheory(JSON.stringify(itemSchema)))
  assert.throws(() => evaluateQuery(store, "Promise.resolve(1)"), /synchronously/)

  const source = StoreHandle.fromTheory(JSON.stringify(itemSchema))
  const transaction = source.beginTransaction()
  assert.throws(() => evaluateExec(transaction, "return Promise.resolve()"), /synchronously/)
  transaction.takeStore()
})
