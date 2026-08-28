// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import {
  Repo,
  initSubduction,
  isValidAutomergeUrl,
  type AutomergeUrl,
} from "@automerge/automerge-repo"
import { create, find } from "@coln-project/repo"
import { render } from "ink"
import * as GraphRealm from "../generated/GraphRealm.ts"
import App from "./App.tsx"

const endpoint = process.env.SUBDUCTION_ENDPOINT
  ?? "wss://subduction.sync.inkandswitch.com"
const url = process.argv[2]

if (url && !isValidAutomergeUrl(url)) {
  console.error("Expected an automerge URL or no argument to create a document.")
  process.exit(1)
}
if (!process.stdin.isTTY) {
  console.error("The sync CLI requires an interactive terminal.")
  process.exit(1)
}

await initSubduction()
const repo = new Repo({
  subductionWebsocketEndpoints: [endpoint],
  subductionTimeouts: { syncMs: 5_000, defaultMs: 5_000 },
})
await waitForSubduction(repo, endpoint)
const handle = url
  ? await find(repo, url as AutomergeUrl, GraphRealm)
  : create(repo, GraphRealm)

let requestQuit!: () => void
const quitRequested = new Promise<void>(resolve => {
  requestQuit = resolve
})
const instance = render(
  <App handle={handle} repo={repo} endpoint={endpoint} onQuit={requestQuit} />,
  { exitOnCtrlC: false },
)
let appRequestedQuit = false

try {
  appRequestedQuit = await Promise.race([
    quitRequested.then(() => true),
    instance.waitUntilExit().then(() => false),
  ])
} finally {
  try {
    await repo.shutdown()
  } finally {
    if (appRequestedQuit) instance.unmount()
  }
}

async function waitForSubduction(repo: Repo, endpoint: string): Promise<void> {
  if (repo.isSubductionConnected()) return

  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error(`Timed out connecting to ${endpoint}`))
    }, 10_000)
    const connected = ({ connected }: { connected: boolean }) => {
      if (!connected) return
      cleanup()
      resolve()
    }
    const cleanup = () => {
      clearTimeout(timeout)
      repo.off("subduction-connection", connected)
    }

    repo.on("subduction-connection", connected)
    if (repo.isSubductionConnected()) {
      cleanup()
      resolve()
    }
  })
}
