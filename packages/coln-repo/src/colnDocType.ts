// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  StoreHandle,
  type CommitChunk,
  type ColnSchema,
  type RealmBindings,
  type Value,
} from "@coln-project/runtime"
import { defineDocumentType, type SedimentreeMeta } from "@automerge/automerge-repo/slim"

export type { ColnSchema, RealmBindings } from "@coln-project/runtime"

export type ColnView = Pick<
  StoreHandle,
  "commitChunksAfter" | "heads" | "jsonIR" | "rowById" | "scanTable"
>

type WithBindingRoot<
  Base,
  Bindings extends RealmBindings | undefined,
  Kind extends "Transaction" | "View",
> = Bindings extends RealmBindings ? Base & Pick<InstanceType<Bindings[Kind]>, "root"> : Base

type ColnDocumentBase = { readonly store: ColnView }
type ColnTransactionBase = { add(path: string, values: Value[]): Value }

export type ColnDocument<Bindings extends RealmBindings | undefined = undefined> = WithBindingRoot<
  ColnDocumentBase,
  Bindings,
  "View"
>

export type ColnTransaction<Bindings extends RealmBindings | undefined = undefined> = WithBindingRoot<
  ColnTransactionBase,
  Bindings,
  "Transaction"
>

export type ColnChange<Bindings extends RealmBindings | undefined = undefined> = (
  transaction: ColnTransaction<Bindings>,
) => void

type ColnChangeFn = (transaction: ColnTransactionBase) => void

export const colnDocType = defineDocumentType<
  ColnDocumentBase,
  ColnDocumentBase,
  ColnChangeFn,
  ColnSchema
>({
  name: "coln",
  empty: () => ({ store: StoreHandle.empty() }),
  init: schema => ({ store: StoreHandle.fromTheory(serializeSchema(schema)) }),
  view: state => ({ store: state.store }),
  change: (state, change) => runTransaction(state, change),
  heads: state => state.store.heads(),
  hasData: state => state.store.heads().length > 0,
  sedimentree: {
    metadata: state => commitChunks(state).map(commitMetadata),
    materialize: (state, metadata) => {
      const wantedHeads = new Set(metadata.map(entry => entry.head))
      // TODO: Add a runtime commitChunksByHash API if full-history scans become costly.
      return commitChunks(state)
        .filter(chunk => wantedHeads.has(chunk.hash))
        .map(chunk => ({ ...commitMetadata(chunk), bytes: new Uint8Array(chunk.bytes) }))
    },
    apply: (state, blobs) => {
      if (blobs.length > 0) {
        // TODO: "Add independent StoreHandle snapshots for Repo document states":
        // apply blobs to a snapshot and return a new document.
        const store = state.store as StoreHandle
        store.applyChunkBytes(blobs)
      }
      return state
    },
    liveHashes: state => commitChunks(state).map(chunk => chunk.hash),
  },
})

function runTransaction(document: ColnDocumentBase, change: ColnChangeFn): ColnDocumentBase {
  // TODO: "Add independent StoreHandle snapshots for Repo document states":
  // start the transaction from a snapshot and leave this document unchanged.
  const transaction = (document.store as StoreHandle).beginTransaction()
  try {
    change(transaction)
    const commit = transaction.commit()
    return { store: commit.takeStore() }
  } catch (error) {
    // beginTransaction() moved ownership of the store into the transaction, and on
    // error we cannot return a fresh document. Recover the (aborted) store back onto
    // the existing state object, otherwise it would hold a dead StoreHandle.
    const mutableDocument = document as { store: StoreHandle }
    mutableDocument.store = transaction.takeStore()
    throw error
  }
}

function serializeSchema(schema: ColnSchema): string {
  const serialized = JSON.stringify(schema)
  if (serialized === undefined) throw new Error("creating a Coln store requires a schema")
  return serialized
}

// TODO: Every call pays to serialize chunk bytes as number[] across the wasm
// boundary, even when only hashes/parents are needed (metadata, liveHashes).
// Switch to Uint8Array output once CommitChunk uses serde_bytes in the runtime.
function commitChunks(document: ColnDocumentBase): CommitChunk[] {
  return document.store.commitChunksAfter([])
}

function commitMetadata(chunk: CommitChunk): SedimentreeMeta {
  return { kind: "commit", head: chunk.hash, parents: chunk.parents }
}
