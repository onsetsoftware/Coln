// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import * as runtime from "@coln-project/runtime"
import type * as Graph from "./Graph.js"
import schema from "./GraphRealm.json" with { type: "json" }

export { schema }

export class View {
  readonly root: Graph.View

  constructor(store: runtime.StoreHandle) {
    this.root = {
      V: new runtime.RowIdSet.View(store, "GraphRealm.V", []),
      E: a => b => new runtime.RowIdSet.View(store, "GraphRealm.E", [a, b]),
    }
  }
}

export class Transaction {
  readonly root: Graph.Transaction

  constructor(store: runtime.StoreHandle, transaction: runtime.TransactionHandle) {
    this.root = {
      V: new runtime.RowIdSet.Transaction(store, "GraphRealm.V", [], transaction),
      E: a => b =>
        new runtime.RowIdSet.Transaction(store, "GraphRealm.E", [a, b], transaction),
    }
  }
}
