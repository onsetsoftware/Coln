import type { AutomergeUrl, CrdtDocHandle, Repo } from "@automerge/automerge-repo"
import type { RealmBindings, TransactionHandle } from "@coln-project/runtime"
import {
  colnDocType,
  type ColnDocument,
  type ColnSchema,
} from "./colnDocType.js"

type RawColnHandle = CrdtDocHandle<typeof colnDocType>
export type ColnTransaction<Bindings extends RealmBindings> = TransactionHandle & {
  root: InstanceType<Bindings["Transaction"]>["root"]
}

export interface ColnHandle<Bindings extends RealmBindings> extends RawColnHandle {
  doc(): ColnDocument & {
    realm: InstanceType<Bindings["View"]>
  }
  change(change: (transaction: ColnTransaction<Bindings>) => void): void
}

const bindingsSymbol = Symbol.for("@coln-project/repo/realm-bindings")

export function wrapColnHandle<Bindings extends RealmBindings>(
  handle: RawColnHandle,
  bindings: Bindings,
): ColnHandle<Bindings> {
  // this allows us to access the existing bindings in a typesafe way
  const existingBindings = Reflect.get(handle, bindingsSymbol) as RealmBindings | undefined

  if (existingBindings) {
    if (existingBindings !== bindings) {
      throw new TypeError("Coln handle already uses different realm bindings")
    }
    return handle as ColnHandle<Bindings>
  }

  const originalDoc = handle.doc.bind(handle)
  const originalChange = handle.change.bind(handle)

  Object.defineProperties(handle, {
    [bindingsSymbol]: { value: bindings },
    doc: {
      value: () => {
        const doc = originalDoc()
        return {
          ...doc,
          realm: new bindings.View(doc.store),
        }
      },
    },
    change: {
      value: (callback: (transaction: ColnTransaction<Bindings>) => void) => {
        const store = originalDoc().store
        originalChange(transaction => {
          if ("root" in transaction) {
            throw new TypeError("Transaction already has a root")
          }
          const { root } = new bindings.Transaction(store, transaction)
          Object.assign(transaction, { root })
          callback(transaction as ColnTransaction<Bindings>)
        })
      },
    },
  })

  return handle as ColnHandle<Bindings>
}

export function create<Bindings extends RealmBindings>(
  repo: Repo,
  bindings: Bindings,
): ColnHandle<Bindings> {
  const handle = repo.create(bindings.schema as ColnSchema, colnDocType)

  return wrapColnHandle(handle, bindings)
}

export async function find<Bindings extends RealmBindings>(
  repo: Repo,
  url: AutomergeUrl,
  bindings: Bindings,
): Promise<ColnHandle<Bindings>> {
  const handle = await repo.find(url, colnDocType)

  return wrapColnHandle(handle, bindings)
}
