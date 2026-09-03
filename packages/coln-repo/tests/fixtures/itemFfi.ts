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

interface Root<T> {
  readonly Items: (value: Value) => T
}

export class View {
  readonly root: Root<RowIdSet.View>

  constructor(store: StoreHandle) {
    this.root = {
      Items: value => new RowIdSet.View(store, "Test.Items", [value]),
    }
  }
}

export class Transaction {
  readonly root: Root<RowIdSet.Transaction>

  constructor(store: StoreHandle, transaction: TransactionHandle) {
    this.root = {
      Items: value => new RowIdSet.Transaction(store, "Test.Items", [value], transaction),
    }
  }
}
