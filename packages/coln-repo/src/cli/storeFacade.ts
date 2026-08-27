// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { StoreHandle, type RowRef, type RowView } from "@coln-project/runtime"
import type { ColnView } from "../colnDocType.js"

export interface ReadonlyStore {
  jsonIR(): string
  scanTable(path: string): RowView[]
  rowById(path: string, rowId: RowRef): RowView | undefined
  heads(): string[]
}

export function createStoreSnapshot(source: ColnView): ReadonlyStore {
  const store = StoreHandle.fromTheory(source.jsonIR())
  store.applyChunkBytes(source.commitChunksAfter(store.heads()).map(chunk => chunk.bytes))
  return facade(store)
}

function facade(store: ColnView): ReadonlyStore {
  return Object.freeze({
    jsonIR: () => store.jsonIR(),
    scanTable: (path: string) => store.scanTable(path),
    rowById: (path: string, rowId: RowRef) => store.rowById(path, rowId),
    heads: () => store.heads(),
  })
}
