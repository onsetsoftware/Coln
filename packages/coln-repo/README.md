# `@coln-project/repo`

Coln Repo facilitates sync for Coln stores using [Automerge Repo](https://github.com/automerge/automerge-repo). It currently requires the experimental [doctypes](https://github.com/automerge/automerge-repo/tree/doctypes) branch.

## CLI

The package includes `coln-repo`, a Node CLI for agent-oriented document inspection and updates.

```sh
coln-repo automerge:... ir
coln-repo automerge:... query 'store.scanTable("GraphRealm.V")'
coln-repo automerge:... exec 'txn.add("GraphRealm.V", [])'
```

`query` evaluates a synchronous JavaScript expression with a read-only `store` and prints JSON. `exec` runs a synchronous script with a pre-change, read-only `store` and a write-only `txn` in scope. An `exec` change is atomic and the CLI waits for it to flush to the sync server before exiting successfully.

Pass `-` instead of JavaScript to read multiline code from stdin. Pass `-v` or `--verbose` to print connection and sync progress to stderr.

The default sync server is `wss://subduction.sync.inkandswitch.com`. Override it with `SUBDUCTION_ENDPOINT`:

```sh
SUBDUCTION_ENDPOINT=ws://127.0.0.1:3031 coln-repo automerge:... ir -v
```

Run `coln-repo help`, `coln-repo help query`, or `coln-repo help exec` for the Store interface and examples.

> [!WARNING]
> Query and exec JavaScript is trusted code. It runs with the CLI process's Node capabilities and is not sandboxed.

## Create

Creates a Coln store from a generated schema. Generated bindings add the schema-specific FFI to the handle.

```ts
import * as Bindings from "./ExampleRealm.js";
import { create } from "@coln-project/repo";

const handle = create(repo, Bindings);

handle.change((tx) => {
  tx.root.Items.add();
});
```

## Find

Finds a Coln store by Automerge URL. Bindings are optional; when supplied, they must match the document schema and add the generated FFI to the handle.

```ts
import * as Bindings from "./ExampleRealm.js";
import { find } from "@coln-project/repo";

const handle = await find(repo, url, Bindings);

handle.change((tx) => {
  tx.root.Items.add();
});
```

Bindings can be applied to a raw handle later:

```ts
import * as Bindings from "./ExampleRealm.js";
import { applyBindings, find } from "@coln-project/repo";

const rawHandle = await find(repo, url);
const handle = applyBindings(rawHandle, Bindings);
```

> [!IMPORTANT]
> Once bindings are applied, later raw lookups in the same Repo may return that bound handle. It retains the complete raw API and adds `root` to documents and change transactions.

## Read

Store data is accessed using either the synchronous `handle.doc()` method or the `change` event.

```ts
const doc = handle.doc();
doc.root.Items.values();

handle.on("change", (doc => {
  doc.root.Items.values();
});
```

## Current Limitations

Values returned by `handle.doc()` are current views, not durable snapshots.

Generated read methods such as `has()` and `values()` are not supported inside `handle.change()`. Typed transactions currently support writes only.
