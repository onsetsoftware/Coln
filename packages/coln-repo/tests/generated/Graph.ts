// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type * as runtime from "@coln-project/runtime"

export interface View {
  readonly V: runtime.ColnSet.View
  readonly E: (from: runtime.Value) => (to: runtime.Value) => runtime.ColnSet.View
}

export interface Transaction extends View {
  readonly V: runtime.ColnSet.Transaction
  readonly E: (
    from: runtime.Value,
  ) => (to: runtime.Value) => runtime.ColnSet.Transaction
}
