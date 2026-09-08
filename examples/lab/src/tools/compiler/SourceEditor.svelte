<!-- SPDX-FileCopyrightText: 2026 Coln contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 OR MIT -->

<script lang="ts">
  import { automergeSyncPlugin } from "@automerge/automerge-codemirror"
  import CodeMirrorEditor from "../../lib/CodeMirrorEditor.svelte"
  import type { TheoryDocumentHandle } from "./theory-document.ts"

  let { handle }: { handle: TheoryDocumentHandle } = $props()
</script>

{#key handle}
  <CodeMirrorEditor
    initialValue={handle.doc().source}
    extensions={automergeSyncPlugin({ handle, path: ["source"] })}
    placeholderText="Write your Coln definition here…"
    ariaLabel="Coln definition source"
    hostClass="min-h-[420px] w-full flex-1 overflow-hidden bg-[#0b1112] min-[761px]:min-h-0"
  />
{/key}
