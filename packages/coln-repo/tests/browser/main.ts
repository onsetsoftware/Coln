// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  Repo,
  type AutomergeUrl,
  type CrdtDocHandle,
} from "@automerge/automerge-repo"
import { initSync } from "@automerge/automerge-subduction/slim"
import { wasmBase64 } from "@automerge/automerge-subduction/wasm-base64"
import type { RowView, Value } from "@coln-project/runtime"
import { colnDocType, type ColnDocType, type ColnSchema } from "@coln-project/repo"

initSync({ module: Uint8Array.from(atob(wasmBase64), char => char.charCodeAt(0)) })

const repo = new Repo({
  subductionWebsocketEndpoints: ["ws://127.0.0.1:3031"],
})
let handle: CrdtDocHandle<ColnDocType> | undefined

const api = {
  create(schema: ColnSchema): AutomergeUrl {
    handle = repo.create(schema, colnDocType)
    return handle.url
  },

  async find(url: AutomergeUrl): Promise<void> {
    handle = await repo.find(url, colnDocType)
  },

  add(path: string, values: Value[]): void {
    currentHandle().change(transaction => transaction.add(path, values))
  },

  rows(path: string): RowView[] {
    return currentHandle().doc().store.scanTable(path)
  },

  heads(): string[] {
    return currentHandle().doc().heads
  },

  async flush(): Promise<void> {
    await repo.flush()
  },

  async shutdown(): Promise<void> {
    await repo.shutdown()
  },
}

function currentHandle(): CrdtDocHandle<ColnDocType> {
  if (!handle) throw new Error("no Coln store is open")
  return handle
}

declare global {
  interface Window {
    colnTest: typeof api
  }
}

window.colnTest = api
