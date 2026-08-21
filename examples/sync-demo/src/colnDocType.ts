// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  StoreHandle,
  type CommitChunk,
  type RowRef,
  type TransactionHandle,
  type Value,
} from "@coln-project/runtime"
import {
  defineDocumentType,
  type DocumentType,
  type DocumentTypeContext,
  type SedimentreeMeta,
} from "@automerge/automerge-repo/slim"

export type RowIdValue = Extract<Value, { tag: "row_id" }>

export interface ColnState {
  store: StoreHandle
  actor: string
}

export type ColnFfi<View, Transaction> = {
  schema: unknown
  View: new (store: StoreHandle) => View
  Transaction: new (store: StoreHandle, transaction: TransactionHandle) => Transaction
}

export type AnyColnFfi = ColnFfi<any, any>
export type ColnFfiView<Ffi extends AnyColnFfi> =
  Ffi extends ColnFfi<infer View, any> ? View : never
export type ColnFfiTransaction<Ffi extends AnyColnFfi> =
  Ffi extends ColnFfi<any, infer Transaction> ? Transaction : never

type RawColnDocument = {
  store: StoreHandle
  heads: string[]
}

export type ColnDocument<Ffi extends AnyColnFfi | undefined = undefined> = RawColnDocument &
  (Ffi extends AnyColnFfi ? { realm: ColnFfiView<Ffi> } : {})

export type ColnChange<Ffi extends AnyColnFfi | undefined = undefined> = (
  tx: Ffi extends AnyColnFfi ? ColnFfiTransaction<Ffi> : TransactionHandle,
) => void

export type ColnDocType<
  Ffi extends AnyColnFfi | undefined = undefined,
  View = ColnDocument<Ffi>,
  Change = ColnChange<Ffi>,
  Init = unknown,
> = DocumentType<ColnState, View, Change, Init>

export function colnDocType(): ColnDocType
export function colnDocType<
  Ffi extends AnyColnFfi,
  View = ColnDocument<Ffi>,
  Change = ColnChange<Ffi>,
  Init = unknown,
>(ffi: Ffi): ColnDocType<Ffi, View, Change, Init>
export function colnDocType(ffi?: AnyColnFfi): DocumentType<ColnState, any, any, unknown> {
  const makeEmptyState = (ctx: DocumentTypeContext): ColnState => ({
    store: StoreHandle.empty(),
    actor: ctx.peerId,
  })

  const makeState = (schema: unknown, ctx: DocumentTypeContext): ColnState => {
    const resolvedSchema = schema ?? ffi?.schema
    if (resolvedSchema === undefined) {
      throw new Error("creating a Coln document requires a schema")
    }
    return {
      store: StoreHandle.fromTheory(JSON.stringify(resolvedSchema)),
      actor: ctx.peerId,
    }
  }

  const makeDocument = (state: ColnState) => ({
    ...(ffi ? { realm: new ffi.View(state.store) } : {}),
    store: state.store,
    heads: state.store.heads(),
  })

  const runTransaction = (state: ColnState, body: (tx: unknown) => void): ColnState => {
    const tx = state.store.beginTransaction()
    try {
      body(ffi ? new ffi.Transaction(state.store, tx) : tx)
      const result = tx.commit()
      return { ...state, store: result.takeStore() }
    } catch (error) {
      try {
        state.store = tx.takeStore()
      } catch {
        // ignore; preserve the original error
      }
      throw error
    }
  }

  return defineDocumentType<ColnState, any, any, unknown>({
    name: "coln",
    empty: makeEmptyState,
    init: makeState,
    view: makeDocument,
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
}

export function rowValue(ref: RowRef | null): RowIdValue {
  if (!ref) throw new Error("cannot convert a synthetic row to a row_id value")
  return { tag: "row_id", value: ref }
}

export function refId(ref: RowRef): string {
  if ("existing" in ref) return `${ref.existing.commit}:${ref.existing.counter}`
  return `pending:${ref.pending.txId}:${ref.pending.counter}`
}

function chunks(state: ColnState): CommitChunk[] {
  return state.store.commitChunksAfter([])
}

function chunkToMeta(chunk: CommitChunk): SedimentreeMeta {
  return { kind: "commit", head: chunk.hash, parents: chunk.parents }
}
