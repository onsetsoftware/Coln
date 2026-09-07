# Coln Lab

Coln Lab combines editors for definitions and stores with an interactive Graph Demo.

From the repository root:

```console
just examples/dev-web-lab
```

The command stages the browser compiler and starts or reuses Lab's local
Subduction relay. Build-time browser configuration can be placed in
`examples/lab/.env`; exported shell variables take precedence. See
`examples/lab/.env.example` for available settings.

Store Editor and Graph Demo provide in-browser TypeScript feedback, then execute
the emitted JavaScript on the browser main thread. Run only code you trust.

Lab owns its complete browser implementation, relay scripts, and graph schema.
Regenerate the checked-in graph bindings after changing `src/tools/graph/graph.coln`:

```console
pnpm --dir examples/lab graph:generate
```

Run unit and browser tests with `pnpm --dir examples/lab test` and
`pnpm --dir examples/lab test:e2e`.
