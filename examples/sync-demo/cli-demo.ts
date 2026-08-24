import {
  Repo,
  initSubduction,
  isValidAutomergeUrl,
} from "@automerge/automerge-repo"
import { colnDocType } from "@coln-project/repo"
import type { RowRef, RowView, Value } from "@coln-project/runtime"

const endpoint = "wss://subduction.sync.inkandswitch.com"
const url = process.argv[2]

console.log(`Coln sync CLI

Usage: pnpm --dir examples/sync-demo cli <automerge-url>

  v  add a vertex
  e  add an edge between two random vertices
  c  clear the screen
  q  quit
`)

if (!url || !isValidAutomergeUrl(url)) {
  console.error("Pass the automerge URL shown in the browser demo.")
  process.exit(1)
}

console.log(`Connecting to ${endpoint}...`)
await initSubduction()

const repo = new Repo({ subductionWebsocketEndpoints: [endpoint] })
console.log(`Loading ${url}...`)
const handle = await repo.find(url, colnDocType)
console.log("Store loaded. Watching for changes...")

let lastHeads = ""
const dump = () => {
  const heads = [...handle.heads()].sort().join(",")
  if (heads === lastHeads) return
  lastHeads = heads

  const store = handle.doc().store
  const vertices = store.scanTable("GraphRealm.V").map(row => refId(row.rowId))
  const vertexNames = new Map(vertices.map((id, index) => [id, `V${index + 1}`]))
  const edges = store.scanTable("GraphRealm.E").flatMap(row => {
    const from = valueRefId(row.values[0])
    const to = valueRefId(row.values[1])
    const fromName = from ? vertexNames.get(from) : undefined
    const toName = to ? vertexNames.get(to) : undefined
    return fromName && toName ? [`${fromName} -> ${toName}`] : []
  })

  console.log("\nVertices")
  console.log(vertices.length > 0
    ? vertices.map((id, index) => `  V${index + 1}  ${shortId(id)}`).join("\n")
    : "  (none)")
  console.log("\nEdges")
  console.log(edges.length > 0 ? edges.map(edge => `  ${edge}`).join("\n") : "  (none)")
}

handle.on("change", dump)
handle.on("heads-changed", dump)
dump()

if (!process.stdin.isTTY) {
  console.error("Interactive input requires a TTY.")
  await repo.shutdown()
  process.exit(1)
}

process.stdin.setRawMode(true)
process.stdin.resume()
process.stdin.setEncoding("utf8")
process.stdin.on("data", async (input: string) => {
  for (const key of input) await handleKey(key)
})

async function handleKey(key: string) {
  try {
    if (key === "v") {
      handle.change(transaction => transaction.add("GraphRealm.V", []))
    } else if (key === "e") {
      const vertices = handle.doc().store.scanTable("GraphRealm.V")
      if (vertices.length < 2) {
        console.log("Need at least two vertices.")
        return
      }

      const [from, to] = randomPair(vertices)
      handle.change(transaction =>
        transaction.add("GraphRealm.E", [rowValue(from.rowId), rowValue(to.rowId)]),
      )
    } else if (key === "c") {
      console.clear()
    } else if (key === "q" || key === "\u0003") {
      process.stdin.setRawMode(false)
      await repo.shutdown()
      process.exit(0)
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
  }
}

function randomPair(values: RowView[]): [RowView, RowView] {
  const firstIndex = Math.floor(Math.random() * values.length)
  let secondIndex = Math.floor(Math.random() * (values.length - 1))
  if (secondIndex >= firstIndex) secondIndex += 1
  return [values[firstIndex], values[secondIndex]]
}

function rowValue(ref: RowRef): Value {
  return { tag: "row_id", value: ref }
}

function valueRefId(value: Value | undefined): string | null {
  return value?.tag === "row_id" ? refId(value.value) : null
}

function refId(ref: RowRef): string {
  if ("existing" in ref) return `${ref.existing.commit}:${ref.existing.counter}`
  return `pending:${ref.pending.txId}:${ref.pending.counter}`
}

function shortId(id: string): string {
  return id.slice(0, 8)
}
