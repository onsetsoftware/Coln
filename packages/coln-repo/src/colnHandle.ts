// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type {
  AutomergeUrl,
  CrdtDocHandle,
  Repo,
} from "@automerge/automerge-repo";
import type { RealmBindings, StoreHandle, TransactionHandle } from "@coln-project/runtime";
import {
  colnDocType,
  type ColnDocument,
  type ColnTransaction,
} from "./colnDocType.js";

type RawColnHandle = CrdtDocHandle<typeof colnDocType>;
type FoundColnHandle<Bindings extends RealmBindings | undefined> =
  Bindings extends RealmBindings ? ColnHandle<Bindings> : RawColnHandle;

export interface ColnHandle<Bindings extends RealmBindings> extends RawColnHandle {
  doc(): ColnDocument<Bindings>;
  change(change: (transaction: ColnTransaction<Bindings>) => void): void;
}

const bindingsSymbol = Symbol.for("@coln-project/repo/realm-bindings");

export function applyBindings<Bindings extends RealmBindings>(
  handle: RawColnHandle,
  bindings: Bindings,
): ColnHandle<Bindings> {
  // this allows us to access the existing bindings in a typesafe way
  const existingBindings = Reflect.get(handle, bindingsSymbol) as RealmBindings | undefined;

  if (existingBindings) {
    if (existingBindings !== bindings) {
      throw new TypeError("Coln handle already uses different realm bindings");
    }
    return handle as ColnHandle<Bindings>;
  }

  const actualSchema = canonicalJson(JSON.parse(handle.doc().store.jsonIR()));
  const bindingsSchema = canonicalJson(bindings.schema);
  if (actualSchema !== bindingsSchema) {
    throw new TypeError("Realm bindings schema does not match Coln document schema");
  }

  const originalDoc = handle.doc.bind(handle);
  const originalChange = handle.change.bind(handle);

  // Keep this in-place extension deliberate: raw finds in this repo also see the bound root.
  Object.defineProperties(handle, {
    [bindingsSymbol]: { value: bindings },
    doc: {
      value: () => {
        const doc = originalDoc();
        const { root } = new bindings.View(doc.store as StoreHandle);
        return {
          ...doc,
          root,
        };
      },
    },
    change: {
      value: (callback: (transaction: ColnTransaction<Bindings>) => void) => {
        const store = originalDoc().store as StoreHandle;
        originalChange((transaction) => {
          const { root } = new bindings.Transaction(store, transaction as TransactionHandle);
          Object.assign(transaction, { root });
          callback(transaction as ColnTransaction<Bindings>);
        });
      },
    },
  });

  return handle as ColnHandle<Bindings>;
}

export function create<Bindings extends RealmBindings>(
  repo: Repo,
  bindings: Bindings,
): ColnHandle<Bindings> {
  const handle = repo.create(bindings.schema, colnDocType);

  return applyBindings(handle, bindings);
}

export async function find<Bindings extends RealmBindings | undefined = undefined>(
  repo: Repo,
  url: AutomergeUrl,
  // a rest tuple (rather than an optional parameter) keeps `undefined` in the
  // inferred Bindings, so maybe-undefined arguments produce a union return type
  ...rest: [bindings: Bindings] | []
): Promise<FoundColnHandle<Bindings>> {
  const [bindings] = rest;
  const handle = await repo.find(url, colnDocType);

  return (bindings === undefined ? handle : applyBindings(handle, bindings)) as FoundColnHandle<Bindings>;
}

function canonicalJson(value: unknown): string | undefined {
  return JSON.stringify(value, (_key, current: unknown) => {
    if (current === null || Array.isArray(current) || typeof current !== "object") return current;
    return Object.fromEntries(
      Object.entries(current).sort(([left], [right]) => left.localeCompare(right)),
    );
  });
}
