// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { evaluateQuery } from "../evaluation.js"
import type { RawColnHandle } from "../repository.js"
import { createStoreSnapshot } from "../storeFacade.js"

export function runQuery(handle: RawColnHandle, source: string): void {
  const result = evaluateQuery(createStoreSnapshot(handle.doc().store), source)
  const json = JSON.stringify(result)
  if (json === undefined) throw new TypeError("Query result is not JSON-serializable")
  console.log(json)
}
