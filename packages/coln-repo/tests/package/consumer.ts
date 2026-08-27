// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { AutomergeUrl, CrdtDocHandle, Repo } from "@automerge/automerge-repo"
import type { Value } from "@coln-project/runtime"
import {
  colnDocType,
  find,
  type ColnChange,
  type ColnDocument,
  type ColnHandle,
  type ColnTransaction,
  type RealmBindings,
} from "@coln-project/repo"

type Equal<Left, Right> =
  (<Type>() => Type extends Left ? 1 : 2) extends <Type>() => Type extends Right ? 1 : 2
    ? true
    : false
type Expect<Type extends true> = Type
type RawColnHandle = CrdtDocHandle<typeof colnDocType>

declare const repo: Repo
declare const url: AutomergeUrl
declare const bindings: RealmBindings
declare const optionalBindings: RealmBindings | undefined

const raw = find(repo, url)
const explicitUndefined = find(repo, url, undefined)
const typed = find(repo, url, bindings)
const optional = find(repo, url, optionalBindings)

void raw.then(handle => {
  // @ts-expect-error Documents are readonly.
  handle.doc().store = handle.doc().store
  handle.doc().store.scanTable("Example.Items")
  // @ts-expect-error Store lifecycle is internal.
  handle.doc().store.beginTransaction()
  // @ts-expect-error Store mutation is internal.
  handle.doc().store.applyChunkBytes([])
  // @ts-expect-error Store lifecycle is internal.
  handle.doc().store.free()
  handle.fullDoc().store.scanTable("Example.Items")
  // @ts-expect-error Internal document state is readonly.
  handle.fullDoc().store = handle.fullDoc().store
  // @ts-expect-error Internal document state also hides store lifecycle.
  handle.fullDoc().store.beginTransaction()
})

void typed.then(handle => {
  handle.doc().root
  handle.on("change", () => handle.doc().root)
  handle.on("heads-changed", () => undefined)
  handle.change(transaction => {
    const value: Value = transaction.add("Example.Items", [])
    value
    transaction.root
    // @ts-expect-error Transaction lifecycle is internal.
    transaction.commit()
    // @ts-expect-error Transaction recovery is internal.
    transaction.takeStore()
    // @ts-expect-error Transaction lifecycle is internal.
    transaction.free()
  })
})

export type TypeChecks = [
  Expect<Equal<typeof raw, Promise<RawColnHandle>>>,
  Expect<Equal<typeof explicitUndefined, Promise<RawColnHandle>>>,
  Expect<Equal<typeof typed, Promise<ColnHandle<typeof bindings>>>>,
  Expect<Equal<typeof optional, Promise<RawColnHandle | ColnHandle<typeof bindings>>>>,
  Expect<Equal<ReturnType<ColnHandle<typeof bindings>["doc"]>, ColnDocument<typeof bindings>>>,
  Expect<
    Equal<Parameters<ColnHandle<typeof bindings>["change"]>[0], ColnChange<typeof bindings>>
  >,
  Expect<Equal<Parameters<ColnChange<typeof bindings>>[0], ColnTransaction<typeof bindings>>>,
]
