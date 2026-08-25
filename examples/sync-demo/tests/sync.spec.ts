// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expect, test, type Page } from "@playwright/test"
import {
  initSubduction,
  Repo,
  type AutomergeUrl,
  type CrdtDocHandle,
} from "@automerge/automerge-repo"
import { colnDocType } from "@coln-project/repo"

test("a tab opened after edits loads the coln graph", async ({ browser }) => {
  const context = await browser.newContext()
  const alice = await context.newPage()

  await alice.goto("/")
  await expect(alice.getByTestId("doc-url")).toHaveValue(/^automerge:/)
  await expect(alice.getByTestId("graph-item")).toHaveCount(1)

  await addTwoVerticesAndEdge(alice)

  const url = await alice.getByTestId("doc-url").inputValue()
  const bob = await context.newPage()
  await bob.goto(`/#${url}`)

  await expect(bob.getByTestId("doc-url")).toHaveValue(url)
  await expect(bob.getByTestId("graph-item")).toHaveCount(1)
  await expect(bob.getByTestId("vertex-item")).toHaveCount(2)
  await expect(bob.getByTestId("edge-item")).toHaveCount(1)

  await bob.getByTestId("add-vertex").click()
  await expect(bob.getByTestId("vertex-item")).toHaveCount(3)
  await expect(alice.getByTestId("vertex-item")).toHaveCount(3)
})

test("a tab already open on the doc receives later coln edits", async ({ browser }) => {
  const context = await browser.newContext()
  const alice = await context.newPage()

  await alice.goto("/")
  await expect(alice.getByTestId("doc-url")).toHaveValue(/^automerge:/)
  await expect(alice.getByTestId("graph-item")).toHaveCount(1)

  const url = await alice.getByTestId("doc-url").inputValue()
  const bob = await context.newPage()
  await bob.goto(`/#${url}`)
  await expect(bob.getByTestId("doc-url")).toHaveValue(url)
  await expect(bob.getByTestId("graph-item")).toHaveCount(1)

  await addTwoVerticesAndEdge(alice)

  await expect(bob.getByTestId("vertex-item")).toHaveCount(2)
  await expect(bob.getByTestId("edge-item")).toHaveCount(1)
})

test("browser and CLI-equivalent repos converge across browser reload", async ({ browser }) => {
  await initSubduction()
  const context = await browser.newContext()
  const nodeRepo = new Repo({
    subductionWebsocketEndpoints: ["ws://127.0.0.1:3030"],
  })

  try {
    const browserPage = await context.newPage()
    await browserPage.goto("/")
    await expect(browserPage.getByTestId("doc-url")).toHaveValue(/^automerge:/)

    const url = await browserPage.getByTestId("doc-url").inputValue() as AutomergeUrl
    const probe = await context.newPage()
    await probe.goto(`/#${url}`)
    await expect(probe.getByTestId("graph-item")).toHaveCount(1)
    await probe.close()

    const nodeHandle = await nodeRepo.find(url, colnDocType)

    await addTwoVerticesAndEdge(browserPage)
    await browserPage.evaluate(() => (window as any).repo.flush())
    await expect.poll(() => vertexCount(nodeHandle)).toBe(2)

    nodeHandle.change(transaction => transaction.add("GraphRealm.V", []))
    await nodeRepo.flush()
    nodeRepo.resyncSubduction(nodeHandle.documentId)
    await expect(browserPage.getByTestId("vertex-item")).toHaveCount(3)

    await browserPage.reload()
    await expect(browserPage.getByTestId("doc-url")).toHaveValue(url)
    await expect(browserPage.getByTestId("vertex-item")).toHaveCount(3)
    await expect(browserPage.getByTestId("edge-item")).toHaveCount(1)
  } finally {
    await nodeRepo.shutdown()
    await context.close()
  }
})

async function addTwoVerticesAndEdge(page: Page) {
  await page.getByTestId("add-vertex").click()
  await page.getByTestId("add-vertex").click()
  await expect(page.getByTestId("vertex-item")).toHaveCount(2)

  await selectByIndex(page, "from-select", 0)
  await selectByIndex(page, "to-select", 1)
  await page.getByTestId("add-edge").click()
  await expect(page.getByTestId("edge-item")).toHaveCount(1)
}

async function selectByIndex(page: Page, testId: string, index: number) {
  const values = await page.getByTestId(testId).locator("option").evaluateAll(options =>
    options.map(option => (option as HTMLOptionElement).value)
  )
  expect(values.length).toBeGreaterThan(index)
  await page.getByTestId(testId).selectOption(values[index])
}

function vertexCount(handle: CrdtDocHandle<typeof colnDocType>) {
  return handle.doc().store.scanTable("GraphRealm.V").length
}
