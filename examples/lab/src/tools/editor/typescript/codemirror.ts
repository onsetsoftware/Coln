// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  autocompletion,
  closeCompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  completionStatus,
  pickedCompletion,
  startCompletion,
} from "@codemirror/autocomplete"
import { linter } from "@codemirror/lint"
import type { Extension } from "@codemirror/state"
import { EditorView, hoverTooltip } from "@codemirror/view"
import type { ReplTypeScriptClient } from "./client.ts"

export function typeScriptExtensions(client: ReplTypeScriptClient): Extension {
  return [
    linter(async (view) => {
      try {
        return await client.diagnostics(view.state.doc.toString())
      } catch {
        return []
      }
    }, { delay: 250 }),
    autocompletion({
      override: [async (context: CompletionContext) => {
        const word = context.matchBefore(/[\w$]*/)
        if (!context.explicit && word?.from === word?.to && context.state.sliceDoc(context.pos - 1, context.pos) !== ".") return null
        try {
          const options = await client.completions(context.state.doc.toString(), context.pos)
          const from = Math.min(word?.from ?? context.pos, ...options.map(option => option.from))
          const completionOptions = options.map(({ from: _from, ...option }) => option)
          return prefixCompletionResult(completionOptions, from, context.pos, context)
        } catch {
          return null
        }
      }],
    }),
    EditorView.updateListener.of((update) => {
      if (
        update.docChanged &&
        completionStatus(update.startState) === "active" &&
        !update.transactions.some(transaction => transaction.annotation(pickedCompletion))
      ) queueMicrotask(() => {
        closeCompletion(update.view)
        startCompletion(update.view)
      })
    }),
    hoverTooltip(async (view, position) => {
      try {
        const info = await client.hover(view.state.doc.toString(), position)
        if (!info) return null
        return {
          pos: info.from,
          end: info.to,
          above: true,
          create() {
            const dom = document.createElement("pre")
            dom.className = "cm-typescript-hover"
            dom.textContent = info.text
            return { dom }
          },
        }
      } catch {
        return null
      }
    }),
  ]
}

function prefixCompletionResult(
  options: Completion[],
  from: number,
  to: number,
  context: CompletionContext,
): CompletionResult | null {
  const prefix = context.state.sliceDoc(from, to).toLowerCase()
  const matchingOptions = options.filter(option => option.label.toLowerCase().startsWith(prefix))
  if (matchingOptions.length === 0) return null
  return {
    from,
    to,
    options: matchingOptions,
    validFor: () => false,
  }
}
