<!-- SPDX-FileCopyrightText: 2026 Coln contributors -->
<!-- SPDX-License-Identifier: Apache-2.0 OR MIT -->

<script lang="ts">
  import {
    isValidAutomergeUrl,
    type AutomergeUrl,
    type Repo,
  } from "@automerge/automerge-repo"
  import { Pane, PaneGroup } from "paneforge"
  import { onDestroy, onMount } from "svelte"
  import LabPaneResizer from "../../lib/LabPaneResizer.svelte"
  import JsonViewer from "./JsonViewer.svelte"
  import OutputPanel from "./OutputPanel.svelte"
  import SourceEditor from "./SourceEditor.svelte"
  import StoresPanel from "./StoresPanel.svelte"
  import {
    parseCompiledRealms,
    type CompiledRealm,
  } from "./compiled-realms.ts"
  import {
    loadCompiler,
    type Compilation,
    type Compiler,
  } from "./compiler.ts"
  import { createStore } from "./stores.ts"
  import {
    isTheoryDocument,
    newTheoryDocument,
    type TheoryDocument,
    type TheoryDocumentHandle,
  } from "./theory-document.ts"
  import { TheoryHandle } from "./theory-handle.svelte.ts"
  import { DocumentSync } from "../../lib/document-sync.svelte.ts"
  import type { Router } from "../../lib/router.svelte.ts"
  import DocumentLoadError from "../../app/components/DocumentLoadError.svelte"
  import FeedbackNotice from "../../app/components/FeedbackNotice.svelte"
  import SyncStatus from "../../app/components/SyncStatus.svelte"
  import basicGraphTheory from "../graph/graph.coln?raw"

  type LoadError = "invalid" | "unavailable" | "incompatible"

  let { repo, endpoint, router, documentUrl, trackDocument }: {
    repo: Repo
    endpoint: string
    router: Router
    documentUrl: string
    trackDocument: (documentId: string) => void
  } = $props()

  const emptyCompilation: Compilation = {
    diagnosticsHtml: [],
    prettyIr: [],
    irJson: "",
  }
  const statusDetails = {
    loading: { label: "loading compiler", color: "text-[#91a0a1]", dot: "bg-[#819091]" },
    compiling: { label: "compiling definition", color: "text-[#91a0a1]", dot: "bg-[#819091]" },
    error: { label: "compilation failed", color: "text-[#ff9a86]", dot: "bg-[#ff7657]" },
    ready: { label: "definition compiled", color: "text-[#d8ff57]", dot: "bg-[#d8ff57] shadow-[0_0_12px_#d8ff5788]" },
  }

  let handle = $state<TheoryDocumentHandle>()
  let theoryHandle = $state<TheoryHandle>()
  let sync = $state<DocumentSync>()
  let loadError = $state<LoadError>()
  let compilation = $state<Compilation>(emptyCompilation)
  let status = $state<keyof typeof statusDetails>("loading")
  let error = $state("")
  let compiler = $state<Compiler>()
  let compiledSource = $state("")
  let realms = $state<CompiledRealm[]>([])
  let selectedRealmName = $state("")
  let creatingStore = $state(false)
  let storeError = $state("")
  let feedback = $state("")
  let copyPending = $state(false)
  let openDialog: HTMLDialogElement
  let openDefinitionUrl = $state("")
  let openDefinitionError = $state("")
  let compileTimer: ReturnType<typeof setTimeout> | undefined
  let feedbackTimer: ReturnType<typeof setTimeout> | undefined
  let removeDocumentListener: (() => void) | undefined
  let compileVersion = 0
  let destroyed = false

  const theory = $derived(theoryHandle?.state ?? newTheoryDocument())
  const syncStatus = $derived(sync?.status ?? "offline")
  const syncError = $derived(
    sync?.error instanceof Error ? sync.error.message : String(sync?.error ?? ""),
  )
  const sourceLines = $derived(
    theory.source === "" ? 0 : theory.source.split("\n").length,
  )
  const statusDetail = $derived(statusDetails[status])
  const selectedRealm = $derived(
    realms.find((realm) => realm.name === selectedRealmName),
  )
  const stores = $derived([...theory.stores].reverse())
  const canCreateStore = $derived(
    status === "ready" &&
      compilation.diagnosticsHtml.length === 0 &&
      compiledSource === theory.source &&
      selectedRealm !== undefined &&
      !creatingStore,
  )
  const createStoreHint = $derived(
    creatingStore
      ? "Saving the store before adding it to this definition."
      : status === "compiling" || compiledSource !== theory.source
        ? "Waiting for the current definition source to compile."
        : compilation.diagnosticsHtml.length > 0
          ? "Resolve diagnostics before creating a store."
          : realms.length > 1 && !selectedRealm
            ? "Choose a realm for the new store."
            : "",
  )

  onMount(() => {
    if (documentUrl && !isValidAutomergeUrl(documentUrl)) {
      loadError = "invalid"
      return
    }
    void loadTheory()
  })

  onDestroy(() => {
    destroyed = true
    compileVersion += 1
    clearTimeout(compileTimer)
    clearTimeout(feedbackTimer)
    removeDocumentListener?.()
  })

  async function loadTheory(): Promise<void> {
    try {
      const loaded = documentUrl
        ? await repo.find<TheoryDocument>(documentUrl as AutomergeUrl)
        : repo.create(newTheoryDocument())
      if (destroyed) return
      if (!isTheoryDocument(loaded.doc())) {
        loadError = "incompatible"
        return
      }
      if (!documentUrl) {
        router.replace("compiler", loaded.url)
        return
      }

      handle = loaded
      trackDocument(loaded.documentId)
      theoryHandle = new TheoryHandle(loaded)
      sync = new DocumentSync(repo, loaded)
      let currentSource = loaded.doc().source
      const documentChanged = () => {
        const nextSource = loaded.doc().source
        if (nextSource === currentSource) return
        currentSource = nextSource
        sourceChanged(nextSource, 50)
      }
      loaded.on("change", documentChanged)
      removeDocumentListener = () => loaded.off("change", documentChanged)
      void initializeCompiler()
    } catch (cause) {
      if (!destroyed) loadError = isUnavailable(cause) ? "unavailable" : "incompatible"
    }
  }

  async function initializeCompiler(): Promise<void> {
    try {
      const loadedCompiler = await loadCompiler()
      if (destroyed || !handle) return
      compiler = loadedCompiler
      sourceChanged(handle.doc().source, 0)
    } catch (cause) {
      showError(cause)
    }
  }

  function sourceChanged(source: string, delay: number): void {
    clearTimeout(compileTimer)
    const version = ++compileVersion
    error = ""
    storeError = ""
    compiledSource = ""
    realms = []
    if (source === "") {
      compilation = emptyCompilation
      selectedRealmName = ""
      status = compiler ? "ready" : "loading"
      return
    }
    if (!compiler) {
      status = "loading"
      return
    }
    status = "compiling"
    compileTimer = setTimeout(() => void runCompile(version, source), delay)
  }

  async function runCompile(version: number, source: string): Promise<void> {
    if (!compiler) return
    try {
      const nextCompilation = await compiler.compile(source)
      if (destroyed || version !== compileVersion) return
      const nextRealms = parseCompiledRealms(nextCompilation.irJson)
      compilation = nextCompilation
      compiledSource = source
      realms = nextRealms
      selectedRealmName =
        nextRealms.length === 1
          ? nextRealms[0].name
          : nextRealms.some((realm) => realm.name === selectedRealmName)
            ? selectedRealmName
            : ""
      status = "ready"
    } catch (cause) {
      if (version === compileVersion) showError(cause)
    }
  }

  function showError(cause: unknown): void {
    if (destroyed) return
    error = cause instanceof Error ? cause.message : String(cause)
    status = "error"
  }

  async function createSelectedStore(): Promise<void> {
    if (!canCreateStore || !selectedRealm || !theoryHandle) return
    creatingStore = true
    storeError = ""
    try {
      const { record, theoryFlushError } = await createStore(
        repo,
        theoryHandle,
        selectedRealm,
      )
      showFeedback(`Store created for ${record.realmName}`)
      if (theoryFlushError) {
        const detail =
          theoryFlushError instanceof Error
            ? theoryFlushError.message
            : String(theoryFlushError)
        storeError = `Store created, but Definition Editor could not save its link in this definition: ${detail}`
      }
    } catch (cause) {
      storeError = cause instanceof Error ? cause.message : String(cause)
    } finally {
      creatingStore = false
    }
  }

  function loadBasicGraphTheory(): void {
    if (!handle || handle.doc().source !== "") return
    handle.change((document) => {
      if (document.source === "") document.source = basicGraphTheory
    })
  }

  async function copyText(value: string, message: string): Promise<void> {
    await navigator.clipboard.writeText(value)
    showFeedback(message)
  }

  function showFeedback(message: string): void {
    feedback = message
    clearTimeout(feedbackTimer)
    feedbackTimer = setTimeout(() => (feedback = ""), 2_000)
  }

  function showOpenDialog(): void {
    openDefinitionUrl = ""
    openDefinitionError = ""
    openDialog.showModal()
  }

  function openDefinition(): void {
    const url = openDefinitionUrl.trim()
    if (!isValidAutomergeUrl(url)) {
      openDefinitionError = "Enter a valid definition URL beginning with automerge:."
      return
    }

    openDialog.close()
    router.navigate("compiler", url)
  }

  function isUnavailable(cause: unknown): boolean {
    return cause instanceof Error && /^Document .+ is unavailable$/.test(cause.message)
  }

  const errorCopy = {
    invalid: { label: "INVALID DEFINITION URL", heading: "This is not a valid Definition Editor document URL.", detail: "Check the URL and try again, or create a new definition." },
    unavailable: { label: "DEFINITION UNAVAILABLE", heading: "This definition could not be found.", detail: "The sync server may be unreachable, or the definition may no longer be available." },
    incompatible: { label: "INCOMPATIBLE DEFINITION", heading: "This document is not a supported Coln definition.", detail: "Its structure or version is not supported by this version of Definition Editor." },
  } satisfies Record<LoadError, { label: string; heading: string; detail: string }>
</script>

{#if loadError}
  <DocumentLoadError label={errorCopy[loadError].label} heading={errorCopy[loadError].heading} detail={errorCopy[loadError].detail} {documentUrl} errorKind={loadError} action="Create a new definition" onaction={() => router.navigate("compiler")} />
{:else if handle && theoryHandle}
  {@const currentTheoryUrl = handle.url}
  <section class="lab-tool relative flex h-full min-h-0 flex-col">
    {#if feedback}<FeedbackNotice message={feedback} />{/if}
    <PaneGroup class="theory-pane-group min-h-0 flex-1" direction="horizontal" autoSaveId="coln-lab-theory-workspace">
      <Pane id="theory-source-pane" class="theory-source-pane min-h-0" defaultSize={32} minSize={25} maxSize={50}>
       <section class="flex h-full min-h-0 flex-col border-b border-[#304041] bg-[#101718] min-[761px]:border-r min-[761px]:border-b-0">
         <div class="grid gap-3 border-b border-[#304041] px-4 py-3 min-[761px]:px-5">
           <div class="flex items-start justify-between gap-3">
              <div><p class="m-0 font-['DM_Mono'] text-xs tracking-[.16em] text-[#748284]" data-small-detail>DEFINITION SOURCE</p><p class="mt-1 mb-0 text-sm text-[#91a0a1]">Source for this Coln definition</p></div>
              <div class="flex shrink-0 flex-wrap justify-end gap-2" aria-label="Definition actions">
                <a class="lab-secondary-action content-center no-underline" href={router.href("compiler")} aria-label="New definition" data-testid="new-definition" onclick={(event) => router.follow(event, "compiler")}>New</a>
                <button class="lab-secondary-action" type="button" aria-label="Open definition" onclick={showOpenDialog}>Open</button>
                <button class="lab-secondary-action" type="button" aria-label="Copy definition link" disabled={copyPending} onclick={async () => { copyPending = true; try { await copyText(location.href, "Definition link copied") } catch (cause) { showError(cause) } finally { copyPending = false } }}>Copy link</button>
              </div>
           </div>
           <div class="flex flex-wrap items-center justify-between gap-2 font-['DM_Mono']">
              <div class={`flex items-center gap-2 text-sm tracking-[.06em] uppercase ${statusDetail.color}`} role="status"><span class={`size-1.5 rounded-full ${statusDetail.dot}`}></span>{statusDetail.label}</div>
             <SyncStatus status={syncStatus} compact detail={`${sourceLines} ${sourceLines === 1 ? "line" : "lines"}`} title={syncStatus === "error" ? syncError : endpoint} />
           </div>
         </div>
          <div class="relative flex min-h-0 flex-1">
            <SourceEditor {handle} />
            {#if theory.source === ""}
              <button class="lab-secondary-action absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2" type="button" onclick={loadBasicGraphTheory}>Use basic graph example</button>
            {/if}
          </div>
        </section>
      </Pane>
       <LabPaneResizer label="Resize definition source and compilation output" orientation="vertical" testId="theory-source-resizer" />
      <Pane id="theory-output-pane" class="theory-output-pane min-h-0" defaultSize={43} minSize={30} maxSize={60}>
       <section class={`grid h-full content-start gap-4 overflow-auto bg-[#131b1c] p-4 transition-opacity min-[761px]:p-6 ${status === "compiling" ? "opacity-55" : "opacity-100"}`} aria-busy={status === "compiling"}>
            {#if error}<div class="lab-alert" role="alert">Definition Editor error: {error}</div>{/if}
            {#if syncStatus === "error"}<div class="lab-alert" role="alert">Definition sync failed: {syncError}</div>{/if}
          <OutputPanel label="Diagnostics" index="01">{#if compilation.diagnosticsHtml.length === 0}<p class="m-0 text-[#667576]">No compilation diagnostics</p>{:else}<div class="diagnostics grid gap-4">{#each compilation.diagnosticsHtml as diagnostic}<div>{@html diagnostic}</div>{/each}</div>{/if}</OutputPanel>
         <OutputPanel label="Compiled IR" index="02">{#if compilation.prettyIr.length === 0}<p class="m-0 text-[#667576]">No compiled intermediate representation</p>{:else}<div class="grid gap-4">{#each compilation.prettyIr as realm}<pre class="m-0 whitespace-pre-wrap wrap-break-word">{realm}</pre>{/each}</div>{/if}</OutputPanel>
         <OutputPanel label="IR as JSON" index="03">{#if compilation.irJson === ""}<p class="m-0 text-[#667576]">No compiled IR JSON</p>{:else}<JsonViewer value={compilation.irJson} />{/if}</OutputPanel>
       </section>
      </Pane>
      <LabPaneResizer label="Resize compilation output and stores" orientation="vertical" testId="theory-stores-resizer" />
      <Pane id="theory-stores-pane" class="theory-stores-pane min-h-0" defaultSize={25} minSize={18} maxSize={40}>
        <StoresPanel {stores} {realms} {selectedRealmName} canCreate={canCreateStore} creating={creatingStore} error={storeError} hint={createStoreHint} onselect={(name) => (selectedRealmName = name)} oncreate={createSelectedStore} oncopy={(url) => void copyText(url, "Store URL copied")} openhref={(url) => router.href("editor", url, currentTheoryUrl)} onopen={(event, url) => router.follow(event, "editor", url, currentTheoryUrl)} />
      </Pane>
    </PaneGroup>
  </section>
{:else}
    <section class="lab-loading"><p>LOADING DEFINITION EDITOR</p></section>
{/if}

<dialog bind:this={openDialog} class="m-auto w-[calc(100%-2rem)] max-w-2xl border border-[#304041] bg-[#131b1c] p-0 text-[#edf0e7] backdrop:bg-[#080d0dcc]" aria-labelledby="open-definition-heading">
  <form onsubmit={(event) => { event.preventDefault(); openDefinition() }}>
    <div class="border-b border-[#304041] p-5 min-[761px]:p-7">
      <p class="m-0 font-['DM_Mono'] text-xs tracking-[.16em] text-[#748284]" data-small-detail>DEFINITION EDITOR / OPEN DEFINITION</p>
      <h2 id="open-definition-heading" class="mt-4 mb-2 text-2xl font-semibold tracking-[-.02em] min-[761px]:text-3xl">Open a Coln definition.</h2>
      <p class="m-0 max-w-xl text-sm leading-relaxed text-[#91a0a1]">Enter a Definition Editor document URL to continue editing it.</p>
    </div>
    <div class="grid gap-3 p-5 min-[761px]:grid-cols-[1fr_auto_auto] min-[761px]:p-7">
      <input class="h-11 min-w-0 border border-[#6b7a7b] bg-[#0b1112] px-3 font-['DM_Mono'] text-sm text-[#e8ece8] outline-none placeholder:text-[#536163] focus:border-[#d8ff57]" aria-label="Definition URL" data-testid="definition-url-input" placeholder="automerge:…" autocomplete="off" bind:value={openDefinitionUrl} oninput={() => openDefinitionError = ""} />
      <button class="lab-secondary-action h-11" type="button" onclick={() => openDialog.close()}>Cancel</button>
      <button class="lab-primary-action h-11 px-5 font-['DM_Mono'] text-sm font-medium tracking-[.12em] uppercase" data-testid="open-definition">Open definition</button>
      {#if openDefinitionError}
        <p class="lab-alert m-0 p-3 min-[761px]:col-span-3" role="alert">{openDefinitionError}</p>
      {/if}
    </div>
  </form>
</dialog>
