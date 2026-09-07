// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { svelte } from "@sveltejs/vite-plugin-svelte"
import tailwindcss from "@tailwindcss/vite"
import { copyFile, mkdir } from "node:fs/promises"
import { defineConfig, type Plugin } from "vite"
import wasm from "vite-plugin-wasm"
import { typescriptDeclarations } from "./scripts/typescript-declarations.ts"

function staticToolRoutes(): Plugin {
  let outputDirectory = ""
  return {
    name: "coln-lab-static-routes",
    configResolved(config) {
      outputDirectory = config.build.outDir
    },
    async closeBundle() {
      await Promise.all(
        ["changelog", "compiler", "editor", "sync"].map(async (route) => {
          const directory = `${outputDirectory}/${route}`
          await mkdir(directory, { recursive: true })
          await copyFile(
            `${outputDirectory}/index.html`,
            `${directory}/index.html`,
          )
        }),
      )
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [tailwindcss(), wasm(), svelte(), typescriptDeclarations(), staticToolRoutes()],
  resolve: {
    dedupe: [
      "svelte",
      "@coln-project/runtime",
      "@automerge/automerge",
      "@automerge/automerge-codemirror",
      "@automerge/automerge-repo",
      "@automerge/automerge-subduction",
      "@codemirror/state",
      "@codemirror/view",
      "codemirror",
    ],
  },
  optimizeDeps: {
    include: [
      "@automerge/automerge-repo/slim",
      "@automerge/automerge-codemirror",
      "@codemirror/lang-javascript",
      "@codemirror/state",
      "@codemirror/view",
      "codemirror",
      "json-formatter-js",
    ],
  },
  worker: { plugins: () => [typescriptDeclarations()] },
  build: {
    emptyOutDir: true,
    outDir: "../../_build/web/lab-app",
    target: "esnext",
  },
})
