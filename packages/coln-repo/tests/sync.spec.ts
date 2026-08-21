// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import { expect, test, type Page } from "@playwright/test"
import type { AutomergeUrl } from "@automerge/automerge-repo"
import { itemSchema } from "./fixtures/schema"

const table = "Test.Items"

test("loads, syncs, and stores a Coln document without schema on find", async ({ browser }) => {
  const context = await browser.newContext()
  const creator = await openPage(context.newPage())
  const url = await creator.evaluate(schema => window.colnTest.create(schema), itemSchema)

  await add(creator, "one")
  await creator.evaluate(() => window.colnTest.flush())

  const finder = await openPage(context.newPage())
  await finder.evaluate(url => window.colnTest.find(url), url)
  await expectRows(finder, ["one"])

  await add(finder, "two")
  await finder.evaluate(() => window.colnTest.flush())
  await expectRows(creator, ["one", "two"])

  await creator.evaluate(() => window.colnTest.shutdown())
  await finder.evaluate(() => window.colnTest.shutdown())
  await creator.close()
  await finder.close()

  const reloaded = await openPage(context.newPage())
  await reloaded.evaluate(url => window.colnTest.find(url), url)
  await expectRows(reloaded, ["one", "two"])
})

async function openPage(pagePromise: Promise<Page>): Promise<Page> {
  const page = await pagePromise
  await page.goto("/")
  await page.waitForFunction(() => window.colnTest !== undefined)
  return page
}

async function add(page: Page, value: string) {
  await page.evaluate(
    ({ table, value }) => window.colnTest.add(table, [{ tag: "string", value }]),
    { table, value },
  )
}

async function expectRows(page: Page, values: string[]) {
  await expect
    .poll(() =>
      page.evaluate(table =>
        window.colnTest
          .rows(table)
          .map(row => row.values[0])
          .filter(value => value?.tag === "string")
          .map(value => value.value)
          .sort(),
      table),
    )
    .toEqual([...values].sort())
}
