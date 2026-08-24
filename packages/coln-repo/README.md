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

`found.doc()` returns `{ store }`, the current raw snapshot. Causal heads are
handle metadata available through `found.heads()`.

Creation requires a compiled Coln schema. Finding an existing store does not:
the store initializes from the schema embedded in its root commit.

Generated FFI bindings can be applied locally without changing the underlying
document type:

```ts
import * as ExampleRealm from "./generated/ExampleRealm.js"
import { create } from "@coln-project/repo"

const handle = create(repo, ExampleRealm)

handle.change(transaction => {
  transaction.root.Items.add()
})
```

`create` uses the schema exported by the generated bindings. `RealmBindings`
currently types that schema as `unknown`, so this package casts it to
`ColnSchema` internally. Tightening the runtime type remains follow-up work.

After wrapping, `handle.doc()` returns `{ store, realm }`. The store provides
raw access and the realm provides the generated typed view over that store.

Finding follows the same pattern: find the raw store without schema, then wrap
the returned handle with the matching local FFI. Wrapping decorates the existing
handle in place. Typed transactions retain the raw transaction methods.
