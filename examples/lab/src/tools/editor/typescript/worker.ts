// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

/// <reference lib="webworker" />

import { createSystem, createVirtualTypeScriptEnvironment } from "@typescript/vfs"
import ts from "typescript"
import declarations from "virtual:typescript-declarations"
import {
  type ReplTypeContext,
  type TypeScriptCompletion,
  type TypeScriptDiagnostic,
  type TypeScriptHover,
  type WorkerRequest,
  type WorkerResponse,
} from "./protocol.ts"
import { createReplDocument, replFile } from "./repl-document.ts"

const compilerOptions: ts.CompilerOptions = {
  lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  noEmitOnError: false,
  resolveJsonModule: true,
  skipLibCheck: true,
  strict: true,
  target: ts.ScriptTarget.ES2022,
}
const initialDocument = createReplDocument("")
const files = new Map(Object.entries(declarations))
files.set(replFile, initialDocument.code)
const system = createSystem(files)
const environment = createVirtualTypeScriptEnvironment(
  system,
  [replFile],
  ts,
  compilerOptions,
)
let context: ReplTypeContext = { files: {}, revision: "base" }
let contextFiles = new Set<string>()

function setContext(next: ReplTypeContext): void {
  for (const path of contextFiles) environment.deleteFile(path)
  contextFiles = new Set(Object.keys(next.files))
  for (const [path, content] of Object.entries(next.files))
    environment.createFile(path, content)
  context = next
}

function updateSource(source: string) {
  const document = createReplDocument(source, context.bindingsModule)
  environment.updateFile(replFile, document.code)
  return document
}

function messageText(message: string | ts.DiagnosticMessageChain): string {
  return ts.flattenDiagnosticMessageText(message, "\n")
}

function diagnostics(source: string): TypeScriptDiagnostic[] {
  const document = updateSource(source)
  const found = [
    ...environment.languageService.getSyntacticDiagnostics(replFile),
    ...environment.languageService.getSemanticDiagnostics(replFile),
  ]
  return found.flatMap((diagnostic) => {
    if (diagnostic.start === undefined) return []
    const start = Math.max(diagnostic.start, document.sourceFrom)
    const end = Math.min(
      diagnostic.start + (diagnostic.length ?? 1),
      document.sourceTo,
    )
    if (start >= document.sourceTo || end <= document.sourceFrom) return []
    return [{
      from: start - document.sourceFrom,
      message: messageText(diagnostic.messageText),
      severity: diagnostic.category === ts.DiagnosticCategory.Error
        ? "error" as const
        : diagnostic.category === ts.DiagnosticCategory.Warning
          ? "warning" as const
          : "info" as const,
      to: Math.max(start + 1, end) - document.sourceFrom,
    }]
  })
}

function completionType(kind: ts.ScriptElementKind): TypeScriptCompletion["type"] {
  if (kind === ts.ScriptElementKind.classElement) return "class"
  if (kind === ts.ScriptElementKind.constElement) return "constant"
  if (kind === ts.ScriptElementKind.functionElement) return "function"
  if (kind === ts.ScriptElementKind.interfaceElement) return "interface"
  if (kind === ts.ScriptElementKind.keyword) return "keyword"
  if (kind === ts.ScriptElementKind.memberFunctionElement) return "method"
  if (kind === ts.ScriptElementKind.memberVariableElement) return "property"
  if (kind === ts.ScriptElementKind.typeElement) return "type"
  return "variable"
}

function completions(source: string, position: number): TypeScriptCompletion[] {
  const document = updateSource(source)
  let identifierFrom = position
  while (identifierFrom > 0 && /[\w$]/.test(source[identifierFrom - 1]))
    identifierFrom -= 1
  const result = environment.languageService.getCompletionsAtPosition(
    replFile,
    document.sourceFrom + position,
    { includeCompletionsForImportStatements: false, includeCompletionsForModuleExports: false },
  )
  return result?.entries.map((entry) => ({
    detail: entry.kindModifiers ?? "",
    from: entry.replacementSpan
      ? Math.max(0, entry.replacementSpan.start - document.sourceFrom)
      : identifierFrom,
    label: entry.name,
    type: completionType(entry.kind),
  })) ?? []
}

function hover(source: string, position: number): TypeScriptHover | undefined {
  const document = updateSource(source)
  const info = environment.languageService.getQuickInfoAtPosition(
    replFile,
    document.sourceFrom + position,
  )
  if (!info) return
  const from = Math.max(document.sourceFrom, info.textSpan.start)
  const to = Math.min(document.sourceTo, info.textSpan.start + info.textSpan.length)
  if (from >= document.sourceTo || to <= document.sourceFrom) return
  const signature = ts.displayPartsToString(info.displayParts)
  const documentation = ts.displayPartsToString(info.documentation)
  return {
    from: from - document.sourceFrom,
    text: documentation ? `${signature}\n\n${documentation}` : signature,
    to: to - document.sourceFrom,
  }
}

function emit(source: string): string {
  updateSource(source)
  const output = environment.languageService.getEmitOutput(replFile)
  const javascript = output.outputFiles.find(file => file.name.endsWith(".js"))
  if (!javascript) throw new Error("TypeScript could not emit this program")
  return `${javascript.text}\nreturn __colnRepl(handle, console);`
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  let response: WorkerResponse
  try {
    let result: unknown
    if (request.type === "context") result = setContext(request.context)
    else if (request.type === "diagnostics") result = diagnostics(request.source)
    else if (request.type === "complete") result = completions(request.source, request.position)
    else if (request.type === "hover") result = hover(request.source, request.position)
    else result = emit(request.source)
    response = { id: request.id, ok: true, result }
  } catch (cause) {
    response = {
      id: request.id,
      ok: false,
      error: cause instanceof Error ? cause.message : String(cause),
    }
  }
  self.postMessage(response)
})
