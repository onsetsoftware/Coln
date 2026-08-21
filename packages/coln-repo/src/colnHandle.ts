// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { CrdtDocHandle } from "@automerge/automerge-repo"
import { StoreHandle, type TransactionHandle } from "@coln-project/runtime"
import type { ColnDocType, ColnDocument, ColnSchema } from "./colnDocType.js"

export interface ColnFfi<View, Transaction> {
  schema: ColnSchema
  View: new (store: StoreHandle) => View
  Transaction: new (store: StoreHandle, transaction: TransactionHandle) => Transaction
}

export type AnyColnFfi = ColnFfi<unknown, unknown>

export type ColnFfiView<Ffi extends AnyColnFfi> =
  Ffi extends ColnFfi<infer View, unknown> ? View : never

export type ColnFfiTransaction<Ffi extends AnyColnFfi> =
  Ffi extends ColnFfi<unknown, infer Transaction> ? Transaction : never

export type RawColnHandle = CrdtDocHandle<ColnDocType>

export type ColnHandleDocument<Ffi extends AnyColnFfi> = ColnDocument & {
  realm: ColnFfiView<Ffi>
}

export type ColnHandleTransaction<Ffi extends AnyColnFfi> = TransactionHandle &
  ColnFfiTransaction<Ffi>

export type ColnChangeOptions = Parameters<RawColnHandle["change"]>[1]

export type ColnHandle<Ffi extends AnyColnFfi> = {
  doc(): ColnHandleDocument<Ffi>
  change(
    change: (transaction: ColnHandleTransaction<Ffi>) => void,
    options?: ColnChangeOptions,
  ): void
} & RawColnHandle

interface ColnHandleBinding {
  ffi: AnyColnFfi
  rawDoc: RawColnHandle["doc"]
  rawChange: RawColnHandle["change"]
}

const bindingSymbol = Symbol.for("@coln-project/repo/ffi-binding")

export function wrapColnHandle<Ffi extends AnyColnFfi>(
  rawHandle: RawColnHandle,
  ffi: Ffi,
): ColnHandle<Ffi> {
  const properties = rawHandle as unknown as Record<PropertyKey, unknown>
  const existingBinding = properties[bindingSymbol] as
    | ColnHandleBinding
    | undefined

  if (existingBinding) {
    if (JSON.stringify(existingBinding.ffi.schema) !== JSON.stringify(ffi.schema)) {
      throw new TypeError(
        "Coln handle is already bound to a different FFI schema",
      )
    }
    existingBinding.ffi = ffi
    return rawHandle as ColnHandle<Ffi>
  }

  const binding: ColnHandleBinding = {
    ffi,
    rawDoc: rawHandle.doc.bind(rawHandle),
    rawChange: rawHandle.change.bind(rawHandle),
  }

  Object.defineProperties(rawHandle, {
    [bindingSymbol]: { value: binding },
    doc: {
      value: () => {
        const rawDocument = binding.rawDoc()
        return {
          ...rawDocument,
          realm: new binding.ffi.View(rawDocument.store),
        }
      },
    },
    change: {
      value: (
        callback: (transaction: ColnHandleTransaction<Ffi>) => void,
        options?: ColnChangeOptions,
      ) => {
        const store = binding.rawDoc().store
        binding.rawChange(transaction => {
          const ffiTransaction = new binding.ffi.Transaction(store, transaction)
          for (const property of Reflect.ownKeys(ffiTransaction as object)) {
            if (property in transaction) {
              throw new TypeError(
                `FFI transaction property conflicts with raw transaction: ${String(property)}`,
              )
            }
            Object.defineProperty(
              transaction,
              property,
              Object.getOwnPropertyDescriptor(ffiTransaction, property)!,
            )
          }
          callback(transaction as ColnHandleTransaction<Ffi>)
        }, options)
      },
    },
  })

  return rawHandle as ColnHandle<Ffi>
}
