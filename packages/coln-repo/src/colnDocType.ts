// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { StoreHandle, type CommitChunk, type TransactionHandle } from "@coln-project/runtime"
import {
  defineDocumentType,
  type DocumentType,
  type SedimentreeMeta,
} from "@automerge/automerge-repo/slim"

export type ColnSchema = object

export interface ColnState {
  store: StoreHandle
}

export interface ColnDocument {
  store: StoreHandle
  heads: string[]
}

export type ColnChange = (transaction: TransactionHandle) => void

export type ColnDocType = DocumentType<ColnState, ColnDocument, ColnChange, ColnSchema>

export const colnDocType: ColnDocType = defineDocumentType({
  name: "coln",
  empty: () => ({ store: StoreHandle.empty() }),
  init: schema => ({ store: StoreHandle.fromTheory(serializeSchema(schema)) }),
  view: state => ({ store: state.store, heads: state.store.heads() }),
  change: (state, change) => runTransaction(state, change),
  heads: state => state.store.heads(),
  hasData: state => state.store.heads().length > 0,
  sedimentree: {
    metadata: state => chunks(state).map(chunkToMeta),
    materialize: (state, metas) => {
      const wanted = new Set(metas.map(meta => meta.head))
      return chunks(state)
        .filter(chunk => wanted.has(chunk.hash))
        .map(chunk => ({ ...chunkToMeta(chunk), bytes: new Uint8Array(chunk.bytes) }))
    },
    apply: (state, blobs) => {
      if (blobs.length > 0) {
        state.store.applyChunkBytes(blobs.map(blob => Array.from(blob)))
      }
      return state
    },
    liveHashes: state => chunks(state).map(chunk => chunk.hash),
  },
})

function runTransaction(state: ColnState, change: ColnChange): ColnState {
  const transaction = state.store.beginTransaction()
  try {
    change(transaction)
    const result = transaction.commit()
    return { store: result.takeStore() }
  } catch (error) {
    state.store = transaction.takeStore()
    throw error
  }
}

function serializeSchema(schema: ColnSchema): string {
  const serialized = JSON.stringify(schema)
  if (serialized === undefined) throw new Error("creating a Coln store requires a schema")
  return serialized
}

function chunks(state: ColnState): CommitChunk[] {
  return state.store.commitChunksAfter([])
}

function chunkToMeta(chunk: CommitChunk): SedimentreeMeta {
  return { kind: "commit", head: chunk.hash, parents: chunk.parents }
}
