<!-- SPDX-FileCopyrightText: 2026 Coln contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 OR MIT -->

<script lang="ts">
  import { javascript } from "@codemirror/lang-javascript"
  import { EditorView } from "@codemirror/view"
  import CodeMirrorEditor from "../../lib/CodeMirrorEditor.svelte"
  import type { ReplTypeScriptClient } from "./typescript/client.ts"
  import { typeScriptExtensions } from "./typescript/codemirror.ts"

  let {
    initialValue,
    disabled,
    onchange,
    onrun,
    typescript,
  }: {
    initialValue: string
    disabled: boolean
    onchange: (value: string) => void
    onrun: () => void
    typescript: ReplTypeScriptClient
  } = $props()

  const replEditorMetrics = EditorView.theme({
    ".cm-scroller": { lineHeight: "1.7" },
    ".cm-content": { padding: "18px 0" },
    ".cm-line": { padding: "0 18px 0 12px" },
  })
  const extensions = $derived([
    javascript({ typescript: true }),
    typeScriptExtensions(typescript),
    replEditorMetrics,
  ])
</script>

<CodeMirrorEditor
  {initialValue}
  {extensions}
  {disabled}
  placeholderText="Inspect with handle.doc() or change data with handle.change(txn => …)"
  ariaLabel="Store TypeScript program"
  testId="repl-editor"
  hostClass="min-h-72 flex-1 overflow-hidden bg-[#0b1112]"
  {onchange}
  {onrun}
/>
