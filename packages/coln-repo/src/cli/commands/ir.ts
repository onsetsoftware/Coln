// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { RawColnHandle } from "../repository.js"

export function runIr(handle: RawColnHandle): void {
  console.log(JSON.stringify(JSON.parse(handle.doc().store.jsonIR()), null, 2))
}
