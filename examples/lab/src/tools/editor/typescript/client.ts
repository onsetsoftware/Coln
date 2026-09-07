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
  #ready: Promise<unknown>
  #contextRevision: string
  #failure: Error | undefined

  constructor(context: ReplTypeContext) {
    this.#worker.addEventListener("message", this.#receive)
    this.#worker.addEventListener("error", this.#fail)
    this.#contextRevision = context.revision
    this.#ready = this.#send({ type: "context", context: plainContext(context) })
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
    this.#ready = this.#send({ type: "context", context: plainContext(context) })
      .then((result) => {
        this.#contextRevision = context.revision
        return result
      })
  }

  dispose(): void {
    this.#worker.terminate()
    this.#worker.removeEventListener("message", this.#receive)
    this.#worker.removeEventListener("error", this.#fail)
    this.#fail(new Error("TypeScript worker disposed"))
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
    const error = cause instanceof Error ? cause : new Error(cause.message)
    this.#failure = error
    for (const pending of this.#pending.values()) pending.reject(error)
    this.#pending.clear()
  }
}

function plainContext(context: ReplTypeContext): ReplTypeContext {
  return {
    bindingsModule: context.bindingsModule,
    files: Object.fromEntries(Object.entries(context.files)),
    revision: context.revision,
  }
}
