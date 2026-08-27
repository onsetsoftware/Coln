// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { Value } from "@coln-project/runtime"
import type { ColnTransaction } from "../colnDocType.js"
import type { ReadonlyStore } from "./storeFacade.js"

interface WriteTransaction {
  add(path: string, values: Value[]): Value
}

export function evaluateQuery(store: ReadonlyStore, source: string): unknown {
  const evaluate = new Function("store", `"use strict"; return (${source}\n)`) as (
    store: ReadonlyStore,
  ) => unknown
  const result = evaluate(store)
  assertSynchronous(result)
  return result
}

export function evaluateExec(
  store: ReadonlyStore,
  transaction: ColnTransaction,
  source: string,
): void {
  let active = true
  const exposedTransaction: WriteTransaction = Object.freeze({
    add(path: string, values: Value[]): Value {
      if (!active) throw new Error("Transaction is no longer active")
      return transaction.add(path, values)
    },
  })
  const evaluate = new Function("store", "txn", `"use strict";\n${source}`) as (
    store: ReadonlyStore,
    transaction: WriteTransaction,
  ) => unknown
  try {
    assertSynchronous(evaluate(store, exposedTransaction))
  } finally {
    active = false
  }
}

function assertSynchronous(value: unknown): void {
  if (
    (typeof value === "object" || typeof value === "function")
    && value !== null
    && "then" in value
    && typeof value.then === "function"
  ) {
    throw new TypeError("JavaScript must complete synchronously")
  }
}
