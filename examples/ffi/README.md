# Ideal TypeScript FFI

This hand-written example explores a future compiler output shape. It is not generated.

- A `View` exposes view-capable theory fields through `root`.
- A `Transaction` exposes transaction-capable theory fields through `root`.
- `Graph.Transaction` extends `Graph.View` because each transaction field extends its view equivalent.
- The concrete realm classes remain independent because they construct different object graphs.
- `root` leaves room for future functionality on the realm classes themselves.
- There is no subclass field replacement or factory abstraction.

```ts
import { StoreHandle } from "@coln-project/runtime"
import { Transaction, View, schema } from "./GraphRealm.js"

const store = StoreHandle.fromTheory(JSON.stringify(schema))
const handle = store.beginTransaction()
const transaction = new Transaction(store, handle)

const a = transaction.root.V.add()
const b = transaction.root.V.add()
const edge = transaction.root.E(a)(b).add()

const committedStore = handle.commit().takeStore()
const view = new View(committedStore)

view.root.V.has(a)
view.root.E(a)(b).has(edge)
```

The concrete classes deliberately do not inherit from one another: each constructs a different root,
while `Graph.Transaction` provides the useful type-level inheritance.
