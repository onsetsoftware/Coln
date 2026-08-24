import React from "react"
import ReactDOM from "react-dom/client"
import {
  Repo,
  isValidAutomergeUrl,
  type CrdtDocHandle,
} from "@automerge/automerge-repo"
// @ts-ignore initSync is exported at runtime but may be missing from declarations
import { initSync } from "@automerge/automerge-subduction/slim"
// @ts-ignore wasm-base64 may not have declarations
import { wasmBase64 } from "@automerge/automerge-subduction/wasm-base64"
import { App } from "./App"
import { colnDocType, type ColnDocType } from "./colnDocType"
import * as GraphRealm from "./generated/GraphRealm.ts"

initSync({ module: Uint8Array.from(atob(wasmBase64), c => c.charCodeAt(0)) })

const repo = new Repo({
  subductionWebsocketEndpoints: ["wss://subduction.sync.inkandswitch.com"],
})

const hashUrl = location.hash.slice(1)
const rawMode = new URLSearchParams(location.search).has("raw")

if (rawMode) {
  if (!isValidAutomergeUrl(hashUrl)) {
    throw new Error("Raw mode requires a document URL in the location hash")
  }
  const handle = await repo.find(hashUrl, colnDocType())
  location.hash = handle.url
  Object.assign(window, { repo, handle })
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <RawApp handle={handle} />
    </React.StrictMode>
  )
} else {
  type GraphDocType = ColnDocType<typeof GraphRealm>
  const coln = colnDocType(GraphRealm)
  let handle: CrdtDocHandle<GraphDocType>

  if (isValidAutomergeUrl(hashUrl)) {
    handle = await repo.find(hashUrl, coln)
  } else {
    handle = repo.create(undefined, coln)
  }

  location.hash = handle.url
  Object.assign(window, { repo, handle })
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App handle={handle} />
    </React.StrictMode>
  )
}

function RawApp({ handle }: { handle: CrdtDocHandle<ColnDocType> }) {
  const [doc, setDoc] = React.useState(() => handle.doc())

  React.useEffect(() => {
    const update = () => setDoc(handle.doc())
    handle.on("change", update)
    handle.on("heads-changed", update)
    return () => {
      handle.off("change", update)
      handle.off("heads-changed", update)
    }
  }, [handle])

  return (
    <main>
      <h1>Generic Coln store</h1>
      <div data-testid="raw-heads-count">{handle.heads().length}</div>
      <div data-testid="raw-vertices-count">
        {doc.store.scanTable("GraphRealm.V").length}
      </div>
    </main>
  )
}
