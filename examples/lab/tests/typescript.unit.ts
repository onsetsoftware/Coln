// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { afterEach, describe, expect, it } from "vitest"
import { ReplTypeScriptClient } from "../src/tools/editor/typescript/client.ts"
import { baseReplTypeContext } from "../src/tools/editor/typescript/protocol.ts"
import { graphReplTypeContext } from "../src/tools/graph/graph-repl-type-context.ts"
import { evaluate } from "../src/tools/editor/evaluate.ts"
import type { ColnHandle } from "@coln-project/repo"

let client: ReplTypeScriptClient | undefined

afterEach(() => {
  client?.dispose()
  client = undefined
})

describe("REPL TypeScript service", () => {
  it("uses coln-repo types for diagnostics and completion", async () => {
    client = new ReplTypeScriptClient(baseReplTypeContext)
    const source = 'const count: number = "wrong"\nreturn handle.doc().heads()'
    const diagnostics = await client.diagnostics(source)
    expect(diagnostics.map(diagnostic => diagnostic.message)).toContain(
      "Type 'string' is not assignable to type 'number'.",
    )

    const completionSource = "return handle.doc()."
    const completions = await client.completions(completionSource, completionSource.length)
    expect(completions.map(completion => completion.label)).toEqual(
      expect.arrayContaining(["heads", "jsonIR", "rowById", "scanTable"]),
    )

    const partialSource = "return handle.doc().j"
    const partialCompletions = await client.completions(partialSource, partialSource.length)
    expect(partialCompletions.find(completion => completion.label === "jsonIR")).toMatchObject({
      from: partialSource.length - 1,
    })
    const hover = await client.hover(completionSource, completionSource.indexOf("doc"))
    expect(hover?.text).toContain("doc")
  }, 30_000)

  it("emits TypeScript syntax as executable JavaScript", async () => {
    client = new ReplTypeScriptClient(baseReplTypeContext)
    const output = await client.emit("const value: number = 4\nreturn value * 2")
    expect(output).not.toContain(": number")
    expect(output).toContain("return __colnRepl(handle, console)")
    await expect(evaluate(output, {} as ColnHandle)).resolves.toMatchObject({
      ok: true,
      result: 8,
    })
  })

  it("loads Graph realm types dynamically", async () => {
    client = new ReplTypeScriptClient(baseReplTypeContext)
    client.setContext(new Proxy({
      ...graphReplTypeContext,
      files: new Proxy(graphReplTypeContext.files, {}),
    }, {}))
    const source = "return handle.doc().root."
    const completions = await client.completions(source, source.length)
    expect(completions.map(completion => completion.label)).toEqual(
      expect.arrayContaining(["E", "V"]),
    )

    client.setContext(baseReplTypeContext)
    const baseCompletions = await client.completions(source, source.length)
    expect(baseCompletions).toEqual([])
  })
})
