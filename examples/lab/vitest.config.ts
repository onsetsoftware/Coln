// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { svelte } from "@sveltejs/vite-plugin-svelte"
import { playwright } from "@vitest/browser-playwright"
import { defineConfig } from "vitest/config"
import { typescriptDeclarations } from "./scripts/typescript-declarations.ts"

export default defineConfig({
  plugins: [svelte(), typescriptDeclarations()],
  optimizeDeps: { include: ["@typescript/vfs", "typescript"] },
  resolve: { conditions: ["browser"], dedupe: ["svelte"] },
  worker: { plugins: () => [typescriptDeclarations()] },
  test: {
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
    },
    include: ["tests/**/*.unit.ts"],
  },
})
