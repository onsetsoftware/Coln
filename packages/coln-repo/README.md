# `@coln-project/repo`

Raw Coln document type support for the `doctypes` branch of
`automerge-repo`.

```ts
import { Repo } from "@automerge/automerge-repo"
import { colnDocType } from "@coln-project/repo"

const repo = new Repo()
const created = repo.create(schema, colnDocType)
const found = await repo.find(created.url, colnDocType)

found.change(transaction => {
  transaction.add("Example.Items", [{ tag: "string", value: "item" }])
})
```

Creation requires a compiled Coln schema. Finding an existing store does not:
the store initializes from the schema embedded in its root commit.

Generated FFI bindings can be applied locally without changing the underlying
document type:

```ts
import * as ExampleRealm from "./generated/ExampleRealm.js"
import { wrapColnHandle } from "@coln-project/repo"

const raw = repo.create(ExampleRealm.schema, colnDocType)
const handle = wrapColnHandle(raw, ExampleRealm)

handle === raw // true

handle.change(transaction => {
  transaction.root.Items.add()
})
```

Finding follows the same pattern: find the raw store without schema, then wrap
the returned handle with the matching local FFI. Wrapping decorates the existing
handle in place. Typed transactions retain the raw transaction methods.
