// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  RowIdSet,
  type StoreHandle,
  type TransactionHandle,
  type Value,
} from "@coln-project/runtime"
export { itemSchema as schema } from "./schema.js"

interface ViewShape {
  readonly Items: (value: Value) => RowIdSet.View
}

interface TransactionShape extends ViewShape {
  readonly Items: (value: Value) => RowIdSet.Transaction
}

export class View implements ViewShape {
  readonly Items: ViewShape["Items"]

  constructor(store: StoreHandle) {
    this.Items = value => new RowIdSet.View(store, "Test.Items", [value])
  }
}

export class Transaction implements TransactionShape {
  readonly Items: TransactionShape["Items"]

  constructor(store: StoreHandle, transaction: TransactionHandle) {
    this.Items = value => new RowIdSet.Transaction(store, "Test.Items", [value], transaction)
  }
}
