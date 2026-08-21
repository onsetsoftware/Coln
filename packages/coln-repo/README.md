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
