// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

export interface ReplTypeContext {
  bindingsModule?: string
  files: Record<string, string>
  revision: string
}

export const baseReplTypeContext: ReplTypeContext = {
  files: {},
  revision: "base",
}

export interface TypeScriptDiagnostic {
  from: number
  message: string
  severity: "error" | "warning" | "info"
  to: number
}

export interface TypeScriptCompletion {
  detail: string
  from: number
  label: string
  type: "class" | "constant" | "function" | "interface" | "keyword" | "method" | "property" | "type" | "variable"
}

export interface TypeScriptHover {
  from: number
  text: string
  to: number
}

export type WorkerRequest =
  | { id: number; type: "context"; context: ReplTypeContext }
  | { id: number; type: "diagnostics"; source: string }
  | { id: number; type: "complete"; source: string; position: number }
  | { id: number; type: "hover"; source: string; position: number }
  | { id: number; type: "emit"; source: string }

export type WorkerRequestPayload = WorkerRequest extends infer Request
  ? Request extends { id: number }
    ? Omit<Request, "id">
    : never
  : never

export type WorkerResponse =
  | { id: number; ok: true; result: unknown }
  | { id: number; ok: false; error: string }
