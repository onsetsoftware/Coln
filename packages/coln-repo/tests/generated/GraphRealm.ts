// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import schema from "./GraphRealm.json" with { type: "json" }
import * as runtime from "@coln-project/runtime"
import type * as Graph from "./Graph.js"

export { schema }

export class View implements Graph.View {
  readonly V: Graph.View["V"]
  readonly E: Graph.View["E"]

  constructor(store: runtime.StoreHandle) {
    this.V = new runtime.RowIdSet.View(store, "GraphRealm.V", [])
    this.E = from => to => new runtime.RowIdSet.View(store, "GraphRealm.E", [from, to])
  }
}

export class Transaction implements Graph.Transaction {
  readonly V: Graph.Transaction["V"]
  readonly E: Graph.Transaction["E"]

  constructor(store: runtime.StoreHandle, transaction: runtime.TransactionHandle) {
    this.V = new runtime.RowIdSet.Transaction(store, "GraphRealm.V", [], transaction)
    this.E = from => to =>
      new runtime.RowIdSet.Transaction(store, "GraphRealm.E", [from, to], transaction)
  }
}
