// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

export type Compilation = {
  diagnosticsHtml: string[]
  prettyIr: string[]
  irJson: string
}

type CompileResultPointer = unknown

export type CompilerExports = {
  compile(source: string): Promise<CompileResultPointer>
  freeCompileResult(pointer: CompileResultPointer): Promise<void> | void
  getDiagnostics(asHtml: boolean, pointer: CompileResultPointer): Promise<string[]> | string[]
  prettyIr(pointer: CompileResultPointer): Promise<string[]> | string[]
  irToJson(pointer: CompileResultPointer): Promise<string> | string
}

type WasmLoader = (options: {
  wasmUrl: string
  ghc_wasm_jsffi: (exports: CompilerExports) => WebAssembly.Imports
}) => Promise<CompilerExports>

export type Compiler = {
  compile(source: string): Promise<Compilation>
}

let compilerPromise: Promise<Compiler> | undefined

export function loadCompiler(): Promise<Compiler> {
  compilerPromise ??= initializeCompiler().catch(error => {
    compilerPromise = undefined
    throw error
  })
  return compilerPromise
}

async function initializeCompiler(): Promise<Compiler> {
  const distUrl = `${import.meta.env.BASE_URL}dist/`
  const [loaderModule, jsffiModule] = await Promise.all([
    import(/* @vite-ignore */ `${distUrl}loadHaskellWasm.js`),
    import(/* @vite-ignore */ `${distUrl}ghc_wasm_jsffi.js`),
  ])
  const loadHaskellWasm = loaderModule.default as WasmLoader
  const exports = await loadHaskellWasm({
    wasmUrl: `${distUrl}coln.wasm`,
    ghc_wasm_jsffi: jsffiModule.default,
  })
  return createCompiler(exports)
}

export function createCompiler(exports: CompilerExports): Compiler {
  type Request = {
    source: string
    resolve: (compilation: Compilation) => void
    reject: (error: Error) => void
  }

  let running = false
  let pending: Request | undefined

  const compile = async (source: string): Promise<Compilation> => {
    const pointer = await exports.compile(source)
    try {
      // GHC reactor exports must not be entered concurrently.
      const prettyIr = await exports.prettyIr(pointer)
      const diagnosticsHtml = await exports.getDiagnostics(true, pointer)
      const irJson = await exports.irToJson(pointer)
      return { diagnosticsHtml, prettyIr, irJson }
    } finally {
      await exports.freeCompileResult(pointer)
    }
  }

  const runPending = async (): Promise<void> => {
    if (running || !pending) return
    running = true
    const request = pending
    pending = undefined
    try {
      request.resolve(await compile(request.source))
    } catch (cause) {
      request.reject(cause instanceof Error ? cause : new Error(String(cause)))
    } finally {
      running = false
      void runPending()
    }
  }

  return {
    compile(source) {
      return new Promise((resolve, reject) => {
        if (pending) {
          const error = new Error("Compilation superseded")
          error.name = "AbortError"
          pending.reject(error)
        }
        pending = { source, resolve, reject }
        void runPending()
      })
    },
  }
}
