// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type { ReplTypeContext } from "../editor/typescript/protocol.ts"
import graphSource from "./generated/Graph.ts?raw"
import graphRealmSchema from "./generated/GraphRealm.json?raw"
import graphRealmSource from "./generated/GraphRealm.ts?raw"

const root = "/realms/graph"

export const graphReplTypeContext: ReplTypeContext = {
  bindingsModule: `${root}/GraphRealm.ts`,
  files: {
    [`${root}/Graph.ts`]: graphSource,
    [`${root}/GraphRealm.json`]: graphRealmSchema,
    [`${root}/GraphRealm.ts`]: graphRealmSource,
  },
  revision: "graph-generated",
}
