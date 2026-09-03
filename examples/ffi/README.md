# Ideal TypeScript FFI

This hand-written example explores a future compiler output shape. It is not generated.

- A `View` exposes view-capable fields directly.
- A `Transaction` exposes transaction-capable fields directly.
- `Graph.Transaction` extends `Graph.View` because each transaction field extends its view equivalent.
- The concrete realm classes remain independent because they construct different object graphs.
- There is no `root` wrapper, subclass field replacement, or factory abstraction.

```ts
import { StoreHandle } from "@coln-project/runtime"
import { Transaction, View, schema } from "./GraphRealm.js"

const store = StoreHandle.fromTheory(JSON.stringify(schema))
const handle = store.beginTransaction()
const transaction = new Transaction(store, handle)

const from = transaction.V.add()
const to = transaction.V.add()
const edge = transaction.E(from)(to).add()

const committedStore = handle.commit().takeStore()
const view = new View(committedStore)

view.V.has(from)
view.E(from)(to).has(edge)
```

Current integrations expect constructors whose instances contain a `root` property. They will need a later coordinated change before consuming this shape.
