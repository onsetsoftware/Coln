// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { createRequire } from "node:module"
import { readdir, readFile } from "node:fs/promises"
import { dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import type { Plugin } from "vite"

const moduleId = "virtual:typescript-declarations"
const resolvedModuleId = `\0${moduleId}`
const labDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const require = createRequire(import.meta.url)

async function packageRoot(entry: string, name: string): Promise<string> {
  let directory = dirname(entry)
  while (directory !== dirname(directory)) {
    try {
      const manifest = JSON.parse(await readFile(join(directory, "package.json"), "utf8")) as { name?: string }
      if (manifest.name === name) return directory
    } catch {
      // Keep walking from the package entry toward its manifest.
    }
    directory = dirname(directory)
  }
  throw new Error(`Could not locate ${name} package root from ${entry}`)
}

async function addPackage(
  files: Record<string, string>,
  name: string,
  root: string,
): Promise<void> {
  async function visit(directory: string): Promise<void> {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name)
      if (entry.isDirectory() && entry.name !== "node_modules" && entry.name !== ".git") await visit(path)
      else if (/\.d\.(?:ts|mts|cts)$/.test(entry.name)) {
        files[`/node_modules/${name}/${relative(root, path)}`] = await readFile(path, "utf8")
      }
    }
  }

  files[`/node_modules/${name}/package.json`] = await readFile(join(root, "package.json"), "utf8")
  await visit(root)
}

async function declarations(): Promise<Record<string, string>> {
  const files: Record<string, string> = {}
  const typescriptRoot = await packageRoot(require.resolve("typescript"), "typescript")
  async function addLibrary(name: string): Promise<void> {
    const path = `/lib.${name}.d.ts`
    if (files[path]) return
    const content = await readFile(join(typescriptRoot, "lib", `lib.${name}.d.ts`), "utf8")
    files[path] = content
    await Promise.all(
      [...content.matchAll(/<reference lib="([^"]+)"/g)]
        .map(match => addLibrary(match[1])),
    )
  }
  await Promise.all([addLibrary("es2022"), addLibrary("dom")])

  const automergeRepoEntry = require.resolve("@automerge/automerge-repo")
  const automergeRequire = createRequire(automergeRepoEntry)
  const packageRoots: Array<[string, string]> = [
    ["@coln-project/repo", resolve(labDirectory, "../../packages/coln-repo")],
    ["@coln-project/runtime", resolve(labDirectory, "../../packages/coln-js-runtime")],
    ["@automerge/automerge-repo", await packageRoot(automergeRepoEntry, "@automerge/automerge-repo")],
    ["@automerge/automerge", await packageRoot(automergeRequire.resolve("@automerge/automerge"), "@automerge/automerge")],
    ["@automerge/automerge-subduction", await packageRoot(automergeRequire.resolve("@automerge/automerge-subduction"), "@automerge/automerge-subduction")],
    ["eventemitter3", await packageRoot(automergeRequire.resolve("eventemitter3"), "eventemitter3")],
  ]
  await Promise.all(packageRoots.map(([name, root]) => addPackage(files, name, root)))
  return files
}

let declarationSource: Promise<string> | undefined

export function typescriptDeclarations(): Plugin {
  return {
    name: "coln-lab-typescript-declarations",
    resolveId(id) {
      if (id === moduleId) return resolvedModuleId
    },
    async load(id) {
      if (id === resolvedModuleId) {
        declarationSource ??= declarations().then(files => `export default ${JSON.stringify(files)}`)
        return declarationSource
      }
    },
  }
}
