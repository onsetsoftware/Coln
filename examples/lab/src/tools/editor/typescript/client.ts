// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import type {
  ReplTypeContext,
  TypeScriptCompletion,
  TypeScriptDiagnostic,
  TypeScriptHover,
  WorkerRequest,
  WorkerRequestPayload,
  WorkerResponse,
} from "./protocol.ts"

export class ReplTypeScriptClient {
  readonly #worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" })
  readonly #pending = new Map<number, { resolve: (value: unknown) => void; reject: (cause: Error) => void }>()
  #requestId = 0
  #ready: Promise<void>
  #contextRevision: string
  #disposed = false
  #failure: Error | undefined

  constructor(context: ReplTypeContext) {
    this.#worker.addEventListener("message", this.#receive)
    this.#worker.addEventListener("error", this.#fail)
    this.#contextRevision = context.revision
    this.#ready = this.#contextRequest(context)
  }

  async diagnostics(source: string): Promise<TypeScriptDiagnostic[]> {
    await this.#ready
    return this.#send({ type: "diagnostics", source }) as Promise<TypeScriptDiagnostic[]>
  }

  async completions(source: string, position: number): Promise<TypeScriptCompletion[]> {
    await this.#ready
    return this.#send({ type: "complete", source, position }) as Promise<TypeScriptCompletion[]>
  }

  async hover(source: string, position: number): Promise<TypeScriptHover | undefined> {
    await this.#ready
    return this.#send({ type: "hover", source, position }) as Promise<TypeScriptHover | undefined>
  }

  async emit(source: string): Promise<string> {
    await this.#ready
    return this.#send({ type: "emit", source }) as Promise<string>
  }

  setContext(context: ReplTypeContext): void {
    if (context.revision === this.#contextRevision) return
    this.#ready = this.#contextRequest(context)
  }

  dispose(): void {
    if (this.#disposed) return
    this.#disposed = true
    this.#worker.terminate()
    this.#worker.removeEventListener("message", this.#receive)
    this.#worker.removeEventListener("error", this.#fail)
    const error = new Error("TypeScript worker disposed")
    error.name = "AbortError"
    this.#fail(error)
  }

  async #contextRequest(context: ReplTypeContext): Promise<void> {
    try {
      await this.#send({ type: "context", context: plainContext(context) })
      this.#contextRevision = context.revision
    } catch (cause) {
      this.#failure ??= asError(cause)
    }
  }

  #send(request: WorkerRequestPayload): Promise<unknown> {
    if (this.#failure) return Promise.reject(this.#failure)
    const id = ++this.#requestId
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      try {
        this.#worker.postMessage({ ...request, id } as WorkerRequest)
      } catch (cause) {
        this.#pending.delete(id)
        reject(cause instanceof Error ? cause : new Error(String(cause)))
      }
    })
  }

  #receive = (event: MessageEvent<WorkerResponse>): void => {
    const pending = this.#pending.get(event.data.id)
    if (!pending) return
    this.#pending.delete(event.data.id)
    if (event.data.ok) pending.resolve(event.data.result)
    else pending.reject(new Error(event.data.error))
  }

  #fail = (cause: Error | ErrorEvent): void => {
    const error = asError(cause)
    this.#failure = error
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

function asError(cause: unknown): Error {
  if (cause instanceof Error) return cause
  if (cause instanceof ErrorEvent) return new Error(cause.message)
  return new Error(String(cause))
}

function plainContext(context: ReplTypeContext): ReplTypeContext {
  return {
    bindingsModule: context.bindingsModule,
    files: Object.fromEntries(Object.entries(context.files)),
    revision: context.revision,
  }
}
