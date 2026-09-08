// SPDX-FileCopyrightText: 2026 Coln contributors
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expect, test, type Locator } from "@playwright/test"

async function expectActiveLineHighlight(editor: Locator): Promise<void> {
  await editor.click()
  const activeLine = editor.locator(".cm-activeLine")
  await expect(activeLine).toBeVisible()
  expect(await activeLine.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgba(0, 0, 0, 0)")
  expect(
    await activeLine.evaluate(
      (element) => getComputedStyle(element, "::before").backgroundColor,
    ),
  ).toBe("rgb(17, 26, 27)")
}

async function dragResizer(page: import("@playwright/test").Page, resizer: Locator, deltaX: number, deltaY: number): Promise<void> {
  const box = await resizer.boundingBox()
  expect(box).not.toBeNull()
  const x = box!.x + box!.width / 2
  const y = box!.y + box!.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + deltaX, y + deltaY, { steps: 5 })
  await page.mouse.up()
}

async function expectMinimumTextSize(
  page: import("@playwright/test").Page,
): Promise<void> {
  const violations = await page.locator("body *").evaluateAll((elements) =>
    elements.flatMap((element) => {
      const style = getComputedStyle(element)
      const hasDirectText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )
      const isTextControl =
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      if (
        (!hasDirectText && !isTextControl) ||
        style.display === "none" ||
        style.visibility === "hidden" ||
        element.getClientRects().length === 0
      ) return []
      let size = Number.parseFloat(style.fontSize)
      if (element instanceof SVGTextElement) {
        const transform = element.getScreenCTM()
        if (transform) size *= Math.hypot(transform.a, transform.b)
      }
      const minimum = element.closest("[data-small-detail]") ? 12 : 14
      return size < minimum
        ? [`${element.tagName.toLowerCase()}: ${size}px (${element.textContent?.trim().slice(0, 40)})`]
        : []
    }),
  )
  expect(violations).toEqual([])
}

test("loads every tool from its static route", async ({ page }) => {
  await page.goto("/compiler/")
  await expect(page).toHaveTitle("Definition Editor — Coln Lab")
  await expect(page.getByTestId("active-tool-identity")).toHaveText("Definition Editor")
  await expect(page.getByTestId("active-tool-identity")).toBeVisible()
  await expect(page.getByTestId("active-tool-action")).toHaveCount(0)
  await expect(page.locator("main > header")).toHaveCount(1)

  await page.goto("/editor/")
  await expect(page).toHaveTitle("Store Editor — Coln Lab")
  await expect(page.getByTestId("active-tool-identity")).toHaveText("Store Editor")
  await expect(page.getByTestId("active-tool-identity")).toBeVisible()
  await expect(page.getByTestId("active-tool-action")).toHaveAttribute("aria-label", "Open store")
  await expect(page.getByTestId("active-tool-action")).toHaveAttribute("href", "/editor/")
  await expect(
    page.getByRole("heading", { name: "Inspect a Coln store." }),
  ).toBeVisible()

  await page.goto("/sync/")
  await expect(page).toHaveTitle("Graph Demo — Coln Lab")
  await expect(page.getByTestId("active-tool-identity")).toHaveText("Graph Demo")
  await expect(page.getByTestId("active-tool-identity")).toBeVisible()
  await expect(page.getByTestId("active-tool-action")).toHaveAttribute("aria-label", "New graph")
  await expect(page.getByTestId("active-tool-action")).toHaveAttribute("href", "/sync/")
})

test("opens the changelog from the homepage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")

  await page.getByRole("link", { name: "Changelog" }).click()
  await expect(page).toHaveURL(/\/changelog\/$/)
  await expect(page).toHaveTitle("Changelog — Coln Lab")
  await expect(page.getByRole("heading", { name: "Changelog" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Initial demo" })).toBeVisible()
  await expect(page.getByText("September 7, 2026")).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
})

test("highlights the active compiler line", async ({ page }) => {
  await page.goto("/compiler/")
  await expectActiveLineHighlight(page.locator(".cm-content"))
})

test("toggles Vim mode for every editor", async ({ page }) => {
  const pageErrors: string[] = []
  page.on("pageerror", error => pageErrors.push(error.message))
  await page.goto("/compiler/")
  const vimToggle = page.getByTestId("vim-toggle")
  await expect(vimToggle).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator(".cm-vimMode")).toHaveCount(0)

  await vimToggle.click()
  await expect(vimToggle).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".cm-vimMode")).toBeVisible()
  const vimStatus = page.locator(".cm-vim-panel")
  await expect(vimStatus).toBeVisible()
  const definitionEditor = page.getByRole("textbox", { name: "Coln definition source" })
  await definitionEditor.click({ position: { x: 16, y: 16 } })
  await page.keyboard.press("i")
  await expect(vimStatus).toContainText("INSERT")
  await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCount(0)
  await page.keyboard.press("Escape")
  await page.waitForTimeout(150)
  await expect(definitionEditor).toBeFocused()
  await expect(vimStatus).not.toContainText("INSERT")

  await page.getByRole("link", { name: /Graph Demo/ }).click()
  await expect(page).toHaveURL(/\/sync\/#coln:/)
  const graphDocumentUrl = new URL(page.url()).hash.slice(1)
  await page.getByRole("tab", { name: "Store REPL" }).click()
  await expect(page.locator(".cm-vimMode")).toBeVisible()
  const graphEditor = page.getByTestId("repl-editor")
  await graphEditor.click()
  await page.keyboard.press("i")
  await expect(page.locator(".cm-vim-panel")).toContainText("INSERT")
  await page.keyboard.press("Control+Space")
  await expect(page.locator(".cm-tooltip-autocomplete")).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator(".cm-tooltip-autocomplete")).toHaveCount(0)
  await page.waitForTimeout(150)
  await expect(graphEditor).toBeFocused()
  await expect(page.locator(".cm-vim-panel")).not.toContainText("INSERT")

  await page.goto(`/editor/#${graphDocumentUrl}`)
  await expect(page.locator(".cm-vimMode")).toBeVisible()
  await page.reload()
  await expect(vimToggle).toHaveAttribute("aria-pressed", "true")
  await expect(page.locator(".cm-vimMode")).toBeVisible()

  await vimToggle.click()
  await expect(vimToggle).toHaveAttribute("aria-pressed", "false")
  await expect(page.locator(".cm-vimMode")).toHaveCount(0)
  const storeEditor = page.getByTestId("repl-editor")
  await storeEditor.click()
  await page.keyboard.press("Escape")
  await page.waitForTimeout(150)
  await expect(storeEditor).toBeFocused()
  expect(pageErrors).toEqual([])
})

test("gives Vim normal-mode keys priority over editor keymaps", async ({ page }) => {
  await page.goto("/sync/")
  await page.getByRole("tab", { name: "Store REPL" }).click()
  const editor = page.getByTestId("repl-editor")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+A")
  const lines = Array.from({ length: 60 }, (_, index) => `const line${index} = ${index}`).join("\n")
  await page.keyboard.insertText(lines)

  await page.getByTestId("vim-toggle").click()
  await editor.click({ position: { x: 16, y: 16 } })
  await page.keyboard.press("Escape")
  const vimStatus = page.locator(".cm-vim-panel")
  await expect(vimStatus).toContainText("NORMAL")
  await page.keyboard.type("gg")
  const before = await editor.textContent()
  const lineAt = () => page.locator(".cm-activeLineGutter").first().textContent()
  expect(await lineAt()).toBe("1")

  // macOS standardKeymap binds Ctrl-d to delete-forward; Vim must win.
  await page.keyboard.press("Control+d")
  await page.waitForTimeout(100)
  expect(await editor.textContent()).toBe(before)
  await expect(vimStatus).toContainText("NORMAL")
  expect(Number(await lineAt())).toBeGreaterThan(1)
  await page.keyboard.press("Control+u")
  await page.waitForTimeout(100)
  expect(await editor.textContent()).toBe(before)
  expect(await lineAt()).toBe("1")

  // Completion navigation still works from Vim insert mode.
  await page.keyboard.type("GA")
  await expect(vimStatus).toContainText("INSERT")
  await page.keyboard.insertText("\nreturn handle.doc().")
  await page.keyboard.press("Control+Space")
  const options = page.locator(".cm-tooltip-autocomplete li")
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Control+n")
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Control+p")
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true")
  const accepted = await options.nth(0).locator(".cm-completionLabel").textContent()
  await page.keyboard.press("Control+y")
  await expect(editor).toContainText(`return handle.doc().${accepted}`)
  await expect(vimStatus).toContainText("INSERT")
  await page.keyboard.press("Escape")
  await expect(vimStatus).toContainText("NORMAL")
  await expect(editor).toBeFocused()
})

test("uses control keys to navigate TypeScript completions", async ({ page }) => {
  await page.goto("/sync/")
  await page.getByRole("tab", { name: "Store REPL" }).click()
  const editor = page.getByTestId("repl-editor")
  await editor.click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText("return handle.doc().")
  await page.keyboard.press("Control+Space")

  const options = page.locator(".cm-tooltip-autocomplete li")
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Control+n")
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true")
  await page.keyboard.press("Control+p")
  await expect(options.nth(0)).toHaveAttribute("aria-selected", "true")

  const accepted = await options.nth(0).locator(".cm-completionLabel").textContent()
  await page.keyboard.press("Control+y")
  await expect(editor).toContainText(`return handle.doc().${accepted}`)
})

test("opens an existing definition from the editor", async ({ page }) => {
  await page.goto("/compiler/")
  await expect(page).toHaveURL(/\/compiler\/#automerge:/)
  const firstDefinitionUrl = page.url()

  await page.getByTestId("new-definition").click()
  await expect.poll(() => page.url()).not.toBe(firstDefinitionUrl)
  await expect(page).toHaveURL(/\/compiler\/#automerge:/)

  await page.getByRole("button", { name: "Open definition", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "Open a Coln definition." })
  await expect(dialog).toBeVisible()
  await page.getByTestId("definition-url-input").fill("coln:not-a-definition")
  await page.getByTestId("open-definition").click()
  await expect(dialog.getByRole("alert")).toContainText("automerge:")

  await page.getByTestId("definition-url-input").fill(new URL(firstDefinitionUrl).hash.slice(1))
  await page.getByTestId("open-definition").click()
  await expect(page).toHaveURL(firstDefinitionUrl)
  await expect(dialog).toBeHidden()
  await expect(page.getByText("DEFINITION SOURCE", { exact: true })).toBeVisible()
})

test("resizes and persists graph panes", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto("/sync/")

  const canvas = page.getByTestId("graph-canvas")
  const workspaceResizer = page.getByTestId("graph-workspace-resizer")
  await expect(workspaceResizer).toBeVisible()
  const canvasPaneBox = await page.locator("#graph-canvas-pane").boundingBox()
  const canvasBox = await canvas.boundingBox()
  expect(canvasPaneBox).not.toBeNull()
  expect(canvasBox).not.toBeNull()
  expect(Math.abs(canvasBox!.height - canvasPaneBox!.height)).toBeLessThan(2)
  const graphPanelBox = await page.locator("#graph-graph-panel").boundingBox()
  const storeSummaryBox = await page.getByTestId("store-summary").boundingBox()
  expect(graphPanelBox).not.toBeNull()
  expect(storeSummaryBox).not.toBeNull()
  expect(Math.abs(
    storeSummaryBox!.y + storeSummaryBox!.height - (graphPanelBox!.y + graphPanelBox!.height),
  )).toBeLessThanOrEqual(2)
  const initialCanvasWidth = (await canvas.boundingBox())!.width
  await dragResizer(page, workspaceResizer, -120, 0)
  const resizedCanvasWidth = (await canvas.boundingBox())!.width
  expect(resizedCanvasWidth).toBeLessThan(initialCanvasWidth - 80)

  await expect.poll(() => page.evaluate(() => {
    const value = localStorage.getItem("paneforge:coln-lab-graph-workspace")
    if (!value) return false
    return Object.values(JSON.parse(value) as Record<string, { layout: number[] }>)
      .some(({ layout }) => layout[0] < 60)
  })).toBe(true)
  const persistedWidth = (await canvas.boundingBox())!.width
  await page.reload()
  await expect(page.getByTestId("graph-canvas")).toBeVisible()
  expect(Math.abs((await canvas.boundingBox())!.width - persistedWidth)).toBeLessThan(10)

  await workspaceResizer.focus()
  const keyboardStartWidth = (await canvas.boundingBox())!.width
  await page.keyboard.press("ArrowRight")
  expect((await canvas.boundingBox())!.width).toBeGreaterThan(keyboardStartWidth)

  await page.getByRole("tab", { name: "Store REPL" }).click()
  const output = page.getByTestId("repl-output")
  const outputResizer = page.getByTestId("repl-output-resizer")
  const initialOutputHeight = (await output.boundingBox())!.height
  await dragResizer(page, outputResizer, 0, -80)
  expect((await output.boundingBox())!.height).toBeGreaterThan(initialOutputHeight + 50)

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(workspaceResizer).toBeHidden()
  await expect(outputResizer).toBeHidden()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test("uses the graph demo and moves from theories into their stores", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")
  await expect(
    page.getByRole("heading", { name: "Write definitions. Inspect stores. Explore Coln." }),
  ).toBeVisible()
  await expect(
    page.getByRole("navigation", { name: "Coln Lab" }),
  ).toBeVisible()
  await expect(page.getByRole("group", { name: "Workbench" })).toBeVisible()
  await expect(page.getByRole("group", { name: "Demos" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 1280, height: 800 })

  await page.getByRole("link", { name: /Open Graph Demo/ }).click()
  await expect(page).toHaveURL(/\/sync\/#coln:/)
  const graphUrl = page.url()
  await expect(page.getByTestId("active-tool-identity")).toHaveText("Graph Demo")
  await expect(page.getByTestId("sync-status")).toBeVisible()
  await expect(page.getByTestId("head-count")).toHaveText(/^\d+ heads?$/)
  const graphCanvasBox = await page.getByTestId("graph-canvas").boundingBox()
  const graphControlsBox = await page.getByTestId("graph-sidebar").boundingBox()
  expect(graphCanvasBox).not.toBeNull()
  expect(graphControlsBox).not.toBeNull()
  expect(graphControlsBox!.x).toBeGreaterThan(graphCanvasBox!.x)
  expect(Math.abs(graphControlsBox!.y - graphCanvasBox!.y)).toBeLessThan(2)
  expect(
    await page
      .getByTestId("graph-canvas")
      .evaluate((element) => getComputedStyle(element).minHeight),
  ).toBe("680px")
  await expect(page.getByTestId("store-summary-table")).toHaveCount(2)
  await expectMinimumTextSize(page)
  const vertexSummary = page.locator('[data-table-name="GraphRealm.V"]')
  const edgeSummary = page.locator('[data-table-name="GraphRealm.E"]')
  await page.getByTestId("add-vertex").click()
  await expect(page.getByTestId("graph-vertex")).toHaveCount(1)
  await expect(vertexSummary.getByTestId("store-summary-row-count")).toHaveText("1 row")
  await page.getByTestId("add-vertex").click()
  await expect(page.getByTestId("graph-vertex")).toHaveCount(2)
  await page.getByTestId("graph-vertex").nth(0).click()
  await page.getByTestId("graph-vertex").nth(1).click()
  await expect(page.getByTestId("add-edge")).toBeEnabled()
  await page.getByTestId("add-edge").click()
  await expect(page.getByTestId("graph-edge")).toHaveCount(1)
  await expect(vertexSummary.getByTestId("store-summary-row-count")).toHaveText("2 rows")
  await expect(edgeSummary.getByTestId("store-summary-row-count")).toHaveText("1 row")

  await page.getByRole("tab", { name: "Store REPL" }).click()
  await expect(page).toHaveURL(graphUrl)
  await expect(page.getByTestId("store-repl")).toBeVisible()
  const graphReplEditor = page.getByTestId("repl-editor")
  await expectActiveLineHighlight(graphReplEditor)
  await graphReplEditor.click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText("return handle.doc().root.")
  await page.keyboard.press("Control+Space")
  await expect(page.locator(".cm-tooltip-autocomplete")).toContainText("V")
  await page.keyboard.press("Escape")
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText("const result: unknown = handle.doc().heads()\nreturn result")
  await expect(page.getByTestId("run-program")).toHaveText("Run Ctrl+Enter")
  await page.keyboard.press("Control+Enter")
  await expect(page.getByTestId("repl-result")).toBeVisible()
  await page.getByRole("tab", { name: "Graph" }).click()
  await expect(page.getByTestId("graph-edge")).toHaveCount(1)

  await page.getByRole("tab", { name: "Store REPL" }).click()
  await page.reload()
  await expect(page.getByTestId("store-repl")).toBeVisible()
  await expect(page.getByRole("tab", { name: "Store REPL" })).toHaveAttribute("aria-selected", "true")
  await page.getByRole("tab", { name: "Graph" }).click()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("tab", { name: "Store REPL" })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 1280, height: 800 })

  const labTools = page.getByRole("navigation", { name: "Coln Lab" })
  await labTools.getByRole("link", { name: /Store Editor/ }).click()
  await expect(page).toHaveURL(/\/editor\/$/)
  await expect(page.getByTestId("recent-store")).toHaveCount(0)

  await labTools.getByRole("link", { name: /Definition Editor/ }).click()
  await expect(page).toHaveURL(/\/compiler\/#automerge:/)
  const theoryUrl = page.url()
  const theoryDocumentUrl = new URL(theoryUrl).hash.slice(1)
  await expect(page.getByTestId("active-tool-identity")).toHaveText("Definition Editor")
  await expect(page.getByText("DEFINITION SOURCE", { exact: true })).toBeVisible()
  await expect(page.getByText("Diagnostics", { exact: true })).toBeVisible()
  await expect(page.getByTestId("theory-source-resizer")).toBeVisible()
  await expect(page.getByTestId("theory-stores-resizer")).toBeVisible()
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByTestId("new-definition")).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  const editor = page.locator(".cm-content")
  const graphExample = page.getByRole("button", { name: "Use basic graph example" })
  await expect(graphExample).toBeVisible()
  await graphExample.click()
  await expect(editor).toContainText("theory Graph")
  await expect(editor).toContainText("realm GraphRealm")
  await expect(graphExample).toHaveCount(0)
  const createStore = page.getByRole("button", { name: /Create store/ })
  await expect(createStore).toBeEnabled({ timeout: 60_000 })
  const sourcePanelBox = await page
    .getByText("DEFINITION SOURCE", { exact: true })
    .locator("xpath=ancestor::section[1]")
    .boundingBox()
  const storesPanelBox = await page
    .locator("aside")
    .filter({ hasText: "STORES" })
    .boundingBox()
  expect(sourcePanelBox).not.toBeNull()
  expect(storesPanelBox).not.toBeNull()
  expect(storesPanelBox!.x).toBeGreaterThan(sourcePanelBox!.x)
  expect(Math.abs(storesPanelBox!.y - sourcePanelBox!.y)).toBeLessThan(2)
  await createStore.click()
  await expect(
    page.getByRole("link", { name: "Open in Store Editor", exact: true }),
  ).toBeVisible()

  await page.getByRole("link", { name: "Open in Store Editor", exact: true }).click()
  await expect(page).toHaveURL(/\/editor\/\?theory=automerge%3A.*#coln:/)
  await expect(page.getByTestId("table-option")).toHaveCount(2)
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole("link", { name: "Return to Definition Editor" })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await expectMinimumTextSize(page)
  await page.setViewportSize({ width: 1280, height: 800 })
  const storeBrowser = page.locator("#store-browser-pane")
  const storeBrowserWidth = (await storeBrowser.boundingBox())!.width
  await page.getByTestId("store-workspace-resizer").focus()
  await page.keyboard.press("ArrowRight")
  expect((await storeBrowser.boundingBox())!.width).toBeGreaterThan(storeBrowserWidth)
  await expect(
    page.getByRole("link", { name: "Return to Definition Editor", exact: true }),
  ).toBeVisible()
  const replEditor = page.getByTestId("repl-editor")
  await replEditor.click()
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText("return handle.doc().j")
  await page.keyboard.press("Control+Space")
  const storeCompletions = page.locator(".cm-tooltip-autocomplete")
  await expect(storeCompletions.locator("li").first()).toContainText("jsonIR")
  await expect(storeCompletions).not.toContainText("scanTable")
  await page.keyboard.insertText("s")
  await expect(storeCompletions).toHaveCount(0)
  await page.keyboard.press("ControlOrMeta+A")
  await page.keyboard.insertText(`handle.change((transaction) => {
  const marker: string = "typed"
  const from = transaction.add("GraphRealm.V", [])
  const to = transaction.add("GraphRealm.V", [])
  transaction.add("GraphRealm.E", [from, to])
  console.log(marker)
})
return handle.doc().heads()`)
  await page.getByTestId("run-program").click()
  await expect(page.getByTestId("repl-result")).toBeVisible()
  const edgeTable = page.getByTestId("table-option").filter({ hasText: "GraphRealm.E" })
  await edgeTable.click()
  const references = page.getByTestId("table-reference")
  await expect(references).toHaveCount(2)
  const targetId = (await references.first().getAttribute("aria-label"))!
    .replace("Open referenced row ", "")
  await references.first().click()
  await expect(
    page.getByTestId("table-option").filter({ hasText: "GraphRealm.V" }),
  ).toHaveAttribute("data-selected", "true")
  const targetRow = page.getByTestId("table-row").filter({
    has: page.locator(`td[title="${targetId}"]`),
  })
  await expect(targetRow).toHaveAttribute("data-selected", "true")
  await expect(targetRow).toBeFocused()
  await edgeTable.click()
  await references.first().click()
  await expect(targetRow).toBeFocused()
  const storeDocumentUrl = new URL(page.url()).hash.slice(1)

  await labTools.getByRole("link", { name: /Graph Demo/ }).click()
  await expect(page).toHaveURL(graphUrl)
  await expect(page.getByTestId("graph-vertex")).toHaveCount(2)
  await expect(page.getByTestId("graph-edge")).toHaveCount(1)

  await labTools.getByRole("link", { name: /Definition Editor/ }).click()
  await expect(page).toHaveURL(theoryUrl)
  await expect(page.locator(".cm-content")).toContainText("theory Graph")

  await labTools.getByRole("link", { name: /Store Editor/ }).click()
  await expect(page).toHaveURL(/\/editor\/#coln:/)
  expect(new URL(page.url()).hash.slice(1)).toBe(storeDocumentUrl)
  await expect(page.getByTestId("table-option")).toHaveCount(2)
  await page.getByTestId("active-tool-action").click()
  await expect(page).toHaveURL(/\/editor\/$/)
  await expect(page.getByTestId("recent-store").locator("code")).toHaveAttribute(
    "title",
    storeDocumentUrl,
  )

  await page
    .getByTestId("document-url-input")
    .fill(storeDocumentUrl.replace(/^coln:/, "automerge:"))
  await page.getByTestId("open-store").click()
  await expect(page.getByTestId("load-error")).toBeVisible()
  await expect(page.getByTestId("recent-store")).toBeVisible()

  await page.reload()
  await expect(page.getByTestId("recent-store")).toBeVisible()
  await page.goto(
    `/editor/?theory=${encodeURIComponent(theoryDocumentUrl)}#invalid`,
  )
  await expect(page.getByTestId("load-error")).toBeVisible()
  await expect(page.getByTestId("recent-store")).toBeVisible()
  await page.getByRole("button", { name: "Reopen store" }).click()
  await expect(page).toHaveURL(/\/editor\/#coln:/)
  await expect(page.getByTestId("table-option")).toHaveCount(2)
  await expect(
    page.getByRole("link", { name: "Return to Definition Editor", exact: true }),
  ).toHaveCount(0)
})
