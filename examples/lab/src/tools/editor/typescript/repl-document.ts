// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

export const replFile = "/repl.ts"

export function createReplDocument(source: string, bindingsModule?: string) {
  const handleType = bindingsModule
    ? `import("@coln-project/repo").ColnHandle<typeof import(${JSON.stringify(bindingsModule)})>`
    : `import("@coln-project/repo").ColnHandle`
  const prefix = `async function __colnRepl(\n  handle: ${handleType},\n  console: Pick<Console, "debug" | "info" | "log" | "warn" | "error">,\n) {\n`
  return {
    code: `${prefix}${source}\n}\n`,
    sourceFrom: prefix.length,
    sourceTo: prefix.length + source.length,
  }
}
