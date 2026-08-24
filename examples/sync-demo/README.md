# Coln + automerge-repo web demo

This demo stores a compiler-generated Coln realm in `automerge-repo` using
`@coln-project/repo`. Custom document types aren't part of a released
`automerge-repo` version yet, so both packages use the `doctypes` branch.

`@coln-project/repo` provides typed `create` and `find` helpers that attach the
generated realm bindings to a Coln document handle.

Then, we can create and find handles containing these documents, modify and
render them, and synchronize them using the public subduction sycn server.
That's what most of the code here does.

## Compiling the schema

The demo source schema is:

- `graph.coln`

The generated FFI/IR artifacts live in:

- `src/generated/Graph.ts`
- `src/generated/GraphRealm.ts`
- `src/generated/GraphRealm.json`

`GraphRealm.ts` exports the generated `View`, `Transaction`, and `schema`. The
repo package consumes those bindings directly:

```ts
const handle = create(repo, GraphRealm)
```

`GraphRealm.json` is passed directly to `StoreHandle.fromTheory(...)`; no local
IR-to-FlatTheory translation is needed anymore.

You can compile them by running `./compile.sh`

## Run

Build the local runtime and repo packages from the repository root, then run the
demo:

```bash
npm ci --prefix packages/coln-js-runtime
npm run --prefix packages/coln-js-runtime build
pnpm --dir packages/coln-repo install
pnpm --dir packages/coln-repo build
pnpm --dir examples/sync-demo install
pnpm --dir examples/sync-demo dev
```

Open the Vite URL, then open the hash URL shown in the page in another tab. Each
tab creates its own Repo and syncs via Subduction.

To connect the terminal demo to that document:

```bash
pnpm --dir examples/sync-demo cli <automerge-url>
```

Press `v` to add a vertex, `e` to add an edge between two random vertices, `c`
to clear the screen, or `q` to quit. Synced changes print the current vertices
and edges.

## Build

```bash
pnpm --dir examples/sync-demo build
```

The build script runs:

1. `./compile.sh` to regenerate `src/generated/*` from `graph.coln`
2. `tsc --noEmit`
3. `vite build`

## Test

```bash
pnpm --dir examples/sync-demo exec playwright install chromium # first time only
pnpm --dir examples/sync-demo test:e2e
```
