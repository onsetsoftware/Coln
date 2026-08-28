// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { RowRef, RowView } from "@coln-project/runtime"
import type { ColnView } from "../colnDocType.js"

export interface ReadonlyStore {
  jsonIR(): string
  scanTable(path: string): RowView[]
  rowById(path: string, rowId: RowRef): RowView | undefined
  heads(): string[]
}

export function createStoreFacade(store: ColnView): ReadonlyStore {
  return Object.freeze({
    jsonIR: () => store.jsonIR(),
    scanTable: (path: string) => store.scanTable(path),
    rowById: (path: string, rowId: RowRef) => store.rowById(path, rowId),
    heads: () => store.heads(),
  })
}
