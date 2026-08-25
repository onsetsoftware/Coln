import {
  StoreHandle,
  type CommitChunk,
  type TransactionHandle,
  type ColnSchema,
} from "@coln-project/runtime"
import { defineDocumentType, type SedimentreeMeta } from "@automerge/automerge-repo/slim"

export type { ColnSchema } from "@coln-project/runtime"

export interface ColnDocument {
  store: StoreHandle
}

export type ColnChange = (transaction: TransactionHandle) => void

export const colnDocType = defineDocumentType<ColnDocument, ColnDocument, ColnChange, ColnSchema>({
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
      return commitChunks(state)
        .filter(chunk => wantedHeads.has(chunk.hash))
        .map(chunk => ({ ...commitMetadata(chunk), bytes: new Uint8Array(chunk.bytes) }))
    },
    apply: (state, blobs) => {
      if (blobs.length > 0) {
        state.store.applyChunkBytes(blobs.map(blob => Array.from(blob)))
      }
      return state
    },
    liveHashes: state => commitChunks(state).map(chunk => chunk.hash),
  },
})

function runTransaction(document: ColnDocument, change: ColnChange): ColnDocument {
  const transaction = document.store.beginTransaction()
  try {
    change(transaction)
    const commit = transaction.commit()
    return { store: commit.takeStore() }
  } catch (error) {
    document.store = transaction.takeStore()
    throw error
  }
}

function serializeSchema(schema: ColnSchema): string {
  const serialized = JSON.stringify(schema)
  if (serialized === undefined) throw new Error("creating a Coln store requires a schema")
  return serialized
}

function commitChunks(document: ColnDocument): CommitChunk[] {
  return document.store.commitChunksAfter([])
}

function commitMetadata(chunk: CommitChunk): SedimentreeMeta {
  return { kind: "commit", head: chunk.hash, parents: chunk.parents }
}
