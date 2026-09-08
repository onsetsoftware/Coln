<!-- SPDX-FileCopyrightText: 2026 Coln contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 OR MIT -->

<script lang="ts">
  import { acceptCompletion, closeCompletion, moveCompletionSelection } from "@codemirror/autocomplete"
  import { getCM, Vim, vim, type CodeMirrorV } from "@replit/codemirror-vim"
  import { Compartment, Prec, type Extension } from "@codemirror/state"
  import { EditorView, keymap, placeholder, showPanel } from "@codemirror/view"
  import { basicSetup } from "codemirror"
  import { onMount } from "svelte"
  import { labEditorTheme } from "./codemirror-theme.ts"
  import { useEditorPreferences } from "./editor-preferences.svelte.ts"

  let {
    value,
    extensions,
    disabled = false,
    active = true,
    placeholderText,
    ariaLabel,
    testId,
    hostClass,
    onchange,
    onrun,
  }: {
    value: string
    extensions?: Extension
    disabled?: boolean
    active?: boolean
    placeholderText: string
    ariaLabel: string
    testId?: string
    hostClass: string
    onchange?: (value: string) => void
    onrun?: () => void
  } = $props()

  let host: HTMLDivElement
  let view: EditorView | undefined
  const editorPreferences = useEditorPreferences()
  const editable = new Compartment()
  const vimMode = new Compartment()
  // CodeMirror runs every keymap (including basicSetup's standardKeymap, e.g.
  // macOS Ctrl-d → delete forward) from a single dispatcher whose position is
  // hoisted to Prec.highest by autocompletion's own keymap. Vim's key handler
  // must therefore also be highest precedence and precede the keymaps below,
  // otherwise normal-mode Ctrl-d/Ctrl-u/Ctrl-f/... get swallowed.
  const vimExtension = () => Prec.highest(vim({ status: true }))
  const autocompleteKeymap = Prec.highest(keymap.of([
    {
      key: "Escape",
      run: (editor) => {
        const cm = getCM(editor)
        if (!cm?.state.vim?.insertMode) return false
        closeCompletion(editor)
        Vim.exitInsertMode(cm as CodeMirrorV)
        return true
      },
    },
    { key: "Ctrl-n", run: moveCompletionSelection(true) },
    { key: "Ctrl-p", run: moveCompletionSelection(false) },
    { key: "Ctrl-y", run: acceptCompletion },
  ]))

  // Vim's own status panel already reserves a bottom row (see
  // codemirror-vim's `statusPanel`). Rather than add a second row for the
  // toggle, this always-on panel shares that same row: `.cm-panels-bottom`
  // is laid out as a flex row (see codemirror-theme.ts) so this panel and
  // Vim's status panel sit side by side instead of stacking.
  let vimToggleButton: HTMLButtonElement | undefined

  function syncVimToggleButton(): void {
    if (!vimToggleButton) return
    const enabled = editorPreferences.vimEnabled
    vimToggleButton.textContent = `VIM ${enabled ? "ON" : "OFF"}`
    vimToggleButton.setAttribute("aria-pressed", String(enabled))
    vimToggleButton.setAttribute("aria-label", `${enabled ? "Disable" : "Enable"} Vim mode`)
  }

  const vimTogglePanel = (): Extension => showPanel.of(() => {
    const dom = document.createElement("div")
    dom.className = "cm-vim-toggle-panel"
    dom.dataset.smallDetail = ""
    const button = document.createElement("button")
    button.type = "button"
    button.title = "Toggle Vim mode for all editors"
    button.dataset.testid = "vim-toggle"
    button.onclick = () => editorPreferences.setVimEnabled(!editorPreferences.vimEnabled)
    dom.appendChild(button)
    vimToggleButton = button
    syncVimToggleButton()
    return { dom }
  })

  $effect(() => {
    const enabled = editorPreferences.vimEnabled
    view?.dispatch({ effects: vimMode.reconfigure(enabled ? vimExtension() : []) })
    syncVimToggleButton()
  })

  $effect(() => {
    view?.dispatch({ effects: editable.reconfigure(EditorView.editable.of(!disabled)) })
  })

  $effect(() => {
    if (view && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } })
    }
  })

  $effect(() => {
    if (active) requestAnimationFrame(() => view?.requestMeasure())
  })

  onMount(() => {
    view = new EditorView({
      doc: value,
      parent: host,
      extensions: [
        vimMode.of(editorPreferences.vimEnabled ? vimExtension() : []),
        autocompleteKeymap,
        vimTogglePanel(),
        basicSetup,
        ...(extensions ? [extensions] : []),
        labEditorTheme,
        EditorView.lineWrapping,
        editable.of(EditorView.editable.of(!disabled)),
        placeholder(placeholderText),
        ...(onrun ? [keymap.of([{
          key: "Ctrl-Enter",
          run: () => {
            if (!disabled) onrun()
            return true
          },
        }])] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onchange?.(update.state.doc.toString())
        }),
        EditorView.contentAttributes.of({
          "aria-label": ariaLabel,
          autocapitalize: "off",
          autocomplete: "off",
          spellcheck: "false",
          ...(testId ? { "data-testid": testId } : {}),
        }),
      ],
    })

    const refresh = () => view?.requestMeasure()
    document.fonts.addEventListener("loadingdone", refresh)
    void document.fonts.ready.then(refresh)
    return () => {
      document.fonts.removeEventListener("loadingdone", refresh)
      view?.destroy()
      view = undefined
    }
  })
</script>

<div class={hostClass} bind:this={host}></div>
