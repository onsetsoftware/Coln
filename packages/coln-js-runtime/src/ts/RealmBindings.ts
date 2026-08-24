// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { StoreHandle, TransactionHandle } from "#wasm-bodge/bindings"

export interface RealmBindings<ViewRoot = unknown, TransactionRoot = unknown> {
  schema: unknown
  View: new (store: StoreHandle) => { root: ViewRoot }
  Transaction: new (
    store: StoreHandle,
    transaction: TransactionHandle,
  ) => { root: TransactionRoot }
}
