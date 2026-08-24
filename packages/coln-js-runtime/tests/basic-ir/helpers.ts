// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { StoreHandle, type RealmBindings } from "@coln-project/runtime";

export function beginRealm<ViewRoot, TransactionRoot>(
  realm: RealmBindings<ViewRoot, TransactionRoot>,
) {
  const store = StoreHandle.fromTheory(JSON.stringify(realm.schema));
  const transaction = store.beginTransaction();
  const root = new realm.Transaction(store, transaction).root;

  return {
    root,
    commit(): ViewRoot {
      const committedStore = transaction.commit().takeStore();
      return new realm.View(committedStore).root;
    },
  };
}
