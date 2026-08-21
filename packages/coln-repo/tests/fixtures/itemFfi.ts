// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  RowIdSet,
  type StoreHandle,
  type TransactionHandle,
  type Value,
} from "@coln-project/runtime"
import { itemSchema as schema } from "./schema"

export { schema }

export class View {
  root: {
    Items: (value: Value) => RowIdSet.View
  }

  constructor(store: StoreHandle) {
    this.root = {
      Items: value => new RowIdSet.View(store, "Test.Items", [value]),
    }
  }
}

export class Transaction extends View {
  declare root: {
    Items: (value: Value) => RowIdSet.Transaction
  }

  constructor(store: StoreHandle, transaction: TransactionHandle) {
    super(store)
    this.root = {
      Items: value => new RowIdSet.Transaction(store, "Test.Items", [value], transaction),
    }
  }
}
