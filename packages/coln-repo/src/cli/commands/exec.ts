// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { evaluateExec } from "../evaluation.js"
import type { RawColnHandle } from "../repository.js"

export function runExec(handle: RawColnHandle, source: string): void {
  handle.change(transaction => evaluateExec(transaction, source))
}
