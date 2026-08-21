// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ColnSchema } from "@coln-project/repo"

export const itemSchema = {
  entities: [
    {
      path: [["Test"], ["Items"]],
      value: {
        entityVariant: { tag: "table" },
        columns: [
          {
            path: [["value"]],
            type: { tag: "builtin", type: "builtinString" },
          },
        ],
        primaryKey: null,
      },
    },
  ],
  rules: [],
} satisfies ColnSchema
