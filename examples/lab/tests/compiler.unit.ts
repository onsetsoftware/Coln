// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expect, it, vi } from "vitest"
import {
  createCompiler,
  type CompilerExports,
} from "../src/tools/compiler/compiler.ts"

it("runs the active and latest pending compilation only", async () => {
  let finishFirst: (() => void) | undefined
  const first = new Promise<void>((resolve) => finishFirst = resolve)
  const compile = vi.fn(async (source: string) => {
    if (source === "A") await first
    return source
  })
  const exports: CompilerExports = {
    compile,
    freeCompileResult: vi.fn(),
    getDiagnostics: vi.fn(() => []),
    prettyIr: vi.fn((pointer) => [String(pointer)]),
    irToJson: vi.fn((pointer) => JSON.stringify(pointer)),
  }
  const compiler = createCompiler(exports)

  const a = compiler.compile("A")
  const b = compiler.compile("B")
  const c = compiler.compile("C")
  const d = compiler.compile("D")

  await expect(b).rejects.toMatchObject({ name: "AbortError" })
  await expect(c).rejects.toMatchObject({ name: "AbortError" })
  finishFirst?.()

  await expect(a).resolves.toMatchObject({ prettyIr: ["A"] })
  await expect(d).resolves.toMatchObject({ prettyIr: ["D"] })
  expect(compile).toHaveBeenCalledTimes(2)
  expect(compile.mock.calls.map(([source]) => source)).toEqual(["A", "D"])
})
