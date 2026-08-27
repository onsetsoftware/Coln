// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import type { Value } from "@coln-project/runtime";
import { applyBindings, colnDocType, create, find } from "../src/index";
import * as itemFfi from "./fixtures/itemFfi";
import schema from "./generated/GraphRealm.json" with { type: "json" };
import * as GraphRealm from "./generated/GraphRealm";
import { createTestRepoPair, waitForChange, type TestRepoPair } from "./helpers/TestRepoPair";

let repos: TestRepoPair;

beforeEach(async () => {
  repos = await createTestRepoPair();
});

afterEach(async () => {
  await repos.shutdown();
});

test("create returns a bound, initialized handle", () => {
  const handle = create(repos.source, GraphRealm);

  assert.deepEqual(Object.keys(handle.doc()).sort(), ["root", "store"]);
  assert.equal(handle.heads().length, 1);
});

test("document can be updated and changes are reflected", () => {
  const handle = create(repos.source, GraphRealm);

  let v1!: Value, v2!: Value, e1!: Value;

  handle.change((tx) => {
    v1 = tx.root.V.add();
    v2 = tx.root.V.add();
    e1 = tx.root.E(v1)(v2).add();
  });

  const doc = handle.doc();

  assert(doc.root.V.has(v1));
  assert(doc.root.V.has(v2));
  assert(doc.root.E(v1)(v2).has(e1));
});

test("failed changes are aborted and leave the handle usable", () => {
  const handle = create(repos.source, GraphRealm);
  let committed!: Value;

  assert.throws(
    () =>
      handle.change((transaction) => {
        transaction.root.V.add();
        throw new Error("abort");
      }),
    new Error("abort"),
  );
  handle.change((transaction) => {
    committed = transaction.root.V.add();
  });

  assert.deepEqual(
    handle
      .doc()
      .store.scanTable("GraphRealm.V")
      .map((row) => row.rowId),
    [committed],
  );
});

// Requires independent StoreHandle snapshots for Repo document states.
test.skip("previous documents remain readable and unchanged after later changes", () => {
  const handle = create(repos.source, GraphRealm);
  const before = handle.doc();

  let v1!: Value;

  handle.change((transaction) => {
    v1 = transaction.root.V.add();
  });

  assert.deepEqual(
    before.store.scanTable("GraphRealm.V").map((row) => row.rowId),
    [v1],
  );
});

test.skip("generated reads are available inside changes", () => {
  const handle = create(repos.source, GraphRealm);
  let vertex!: Value;

  handle.change((transaction) => {
    vertex = transaction.root.V.add();
  });
  handle.change((transaction) => {
    assert(transaction.root.V.has(vertex));
  });
});

test("typed handles sync changes", async () => {
  const handle = create(repos.source, GraphRealm);
  const replica = await find(repos.replica, handle.url, GraphRealm);
  let vertex!: Value;

  const changed = waitForChange(replica);
  handle.change((tx) => {
    vertex = tx.root.V.add();
  });
  await changed;

  assert(replica.doc().root.V.has(vertex));
});

test("raw changes sync into a typed handle", async () => {
  const handle = create(repos.source, GraphRealm);
  const replica = await repos.replica.find(handle.url, colnDocType);
  let vertex!: Value;

  const changed = waitForChange(handle);
  replica.change((transaction) => {
    vertex = transaction.add("GraphRealm.V", []);
  });
  await changed;

  assert(handle.doc().root.V.has(vertex));
});

test("find returns a raw handle when bindings are omitted", async () => {
  const handle = create(repos.source, GraphRealm);
  const replica = await find(repos.replica, handle.url);

  assert.deepEqual(Object.keys(replica.doc()), ["store"]);
});

test("bindings can be applied to a raw found handle later", async () => {
  const handle = create(repos.source, GraphRealm);
  const rawReplica = await find(repos.replica, handle.url);
  const replica = applyBindings(rawReplica, GraphRealm);

  assert.strictEqual(replica, rawReplica);
  assert(replica.doc().root.V);
});

test("applying the same bindings twice is idempotent", () => {
  const handle = create(repos.source, GraphRealm);

  assert.strictEqual(applyBindings(handle, GraphRealm), handle);
});

test("applying different bindings to a bound handle is rejected", () => {
  const handle = create(repos.source, GraphRealm);
  const otherBindings = { ...GraphRealm };

  assert.throws(
    () => applyBindings(handle, otherBindings),
    new TypeError("Coln handle already uses different realm bindings"),
  );
});

test("applying bindings for a different schema is rejected", () => {
  const handle = repos.source.create(schema, colnDocType);

  assert.throws(
    () => applyBindings(handle, itemFfi),
    new TypeError("Realm bindings schema does not match Coln document schema"),
  );
});

test("raw lookup remains usable after bindings are applied to the handle", async () => {
  const handle = create(repos.source, GraphRealm);
  const rawHandle = await find(repos.source, handle.url);
  let vertex!: Value;

  rawHandle.change((transaction) => {
    vertex = transaction.add("GraphRealm.V", []);
  });

  assert.strictEqual(rawHandle, handle);
  assert.deepEqual(
    rawHandle
      .doc()
      .store.scanTable("GraphRealm.V")
      .map((row) => row.rowId),
    [vertex],
  );
});
