// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { evaluateExec } from "../evaluation.js"
import type { RawColnHandle } from "../repository.js"
import { createStoreSnapshot } from "../storeFacade.js"

export function runExec(handle: RawColnHandle, source: string): void {
  const store = createStoreSnapshot(handle.doc().store)
  handle.change(transaction => evaluateExec(store, transaction, source))
}
