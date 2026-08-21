// SPDX-FileCopyrightText: 2026 Coln contributors
//
// SPDX-License-Identifier: Apache-2.0 OR MIT

use coln_flir_rs::ir;
use coln_store::{
    commit::{chunk::Chunk, hash::CommitHash as StoreCommitHash, pst::decode_commit_chunks},
    store::Store,
    table::RowId as StoreRowId,
    txn::{OwnedTransaction, RowHandle as StoreRowHandle},
};
use js_sys::Reflect;

use crate::dto::{CommitChunk, CommitHash, RowId, RowRef, RowView, Value};
use crate::error::js_error;

use wasm_bindgen::JsValue;
use wasm_bindgen::prelude::wasm_bindgen;

#[wasm_bindgen]
pub struct StoreHandle {
    state: StoreHandleState,
}

enum StoreHandleState {
    Uninitialized { chunks: Vec<Vec<u8>> },
    Ready(Store),
    Moved,
}

#[wasm_bindgen]
pub struct TransactionHandle {
    tx: Option<OwnedTransaction>,
    recovered_store: Option<Store>,

    pending_handles: Vec<(StoreRowHandle, JsValue)>,
}

fn resolve_value_id(js_value: &JsValue, row_id: RowId) -> Result<(), JsValue> {
    let row_id = Value::existing_id(row_id);
    let row_id_js = serde_wasm_bindgen::to_value(&row_id).map_err(js_error)?;

    let new_row_ref = Reflect::get(&row_id_js, &"value".into())?;
    Reflect::set(js_value, &"value".into(), &new_row_ref)?;

    Ok(())
}

#[wasm_bindgen]
impl TransactionHandle {
    pub fn add(&mut self, path: String, values: Vec<Value>) -> Result<JsValue, JsValue> {
        let path = ir::Path::from(path);
        let values = values.into_iter().map(|v| v.into()).collect::<Vec<_>>();
        let handle = self.tx()?.add(&path, values).map_err(js_error)?;

        let (tx_id, counter) = handle.pending_ids().map_err(js_error)?;
        let temp_id = Value::temp_id(tx_id, counter);
        let js_value = serde_wasm_bindgen::to_value(&temp_id)?;
        self.pending_handles.push((handle, js_value.clone()));

        Ok(js_value)
    }

    pub fn commit(&mut self) -> Result<CommitResult, JsValue> {
        let tx = self
            .tx
            .take()
            .ok_or_else(|| js_error("transaction has already been committed"))?;

        match tx.commit() {
            Ok((commit, store)) => {
                // at this point the rowhandles would have been resolved to rowids already
                for (handle, value) in &self.pending_handles {
                    let row_id = handle.row_id().map_err(js_error)?;
                    resolve_value_id(value, row_id.into())?;
                }

                Ok(CommitResult {
                    commit: commit.to_string(),
                    store: Some(StoreHandle::ready(store)),
                })
            }
            Err((err, store)) => {
                self.recovered_store = Some(store);
                Err(js_error(format!(
                    "{err}; recover the store with TransactionHandle.takeStore()"
                )))
            }
        }
    }

    // TODO adjust this API to not use take_store to recover but return the store
    // after committing
    #[wasm_bindgen(js_name = takeStore)]
    pub fn take_store(&mut self) -> Result<StoreHandle, JsValue> {
        let store = self
            .recovered_store
            .take()
            .ok_or_else(|| js_error("transaction does not have a recovered store"))?;

        Ok(StoreHandle::ready(store))
    }
}

#[wasm_bindgen]
pub struct CommitResult {
    commit: String,
    store: Option<StoreHandle>,
}

#[wasm_bindgen]
impl StoreHandle {
    pub fn empty() -> StoreHandle {
        Self {
            state: StoreHandleState::Uninitialized { chunks: Vec::new() },
        }
    }

    #[wasm_bindgen(js_name = fromTheory)]
    pub fn from_theory(flat_theory_json: String) -> Result<StoreHandle, JsValue> {
        let theory = serde_json::from_str::<ir::FlatRealm>(&flat_theory_json)
            .map_err(|err| js_error(format!("invalid flat theory JSON: {err}")))?;
        let store = Store::try_from_theory(theory).map_err(js_error)?;

        Ok(Self::ready(store))
    }

    #[wasm_bindgen(js_name = scanTable)]
    pub fn scan_table(&self, path: String) -> Result<Vec<RowView>, JsValue> {
        let path = ir::Path::from(path);
        let rows = self
            .store()?
            .scan_table(&path)
            .map(|rows| rows.map(RowView::from).collect::<Vec<_>>())
            .unwrap_or_default();

        Ok(rows)
    }

    #[wasm_bindgen(js_name = rowById)]
    pub fn row_by_id(&self, path: String, row_id: RowRef) -> Result<Option<RowView>, JsValue> {
        let path = ir::Path::from(path);
        let row_id = StoreRowId::try_from(row_id).map_err(js_error)?;

        Ok(self.store()?.row_by_id(&path, row_id).map(RowView::from))
    }

    #[wasm_bindgen(js_name = beginTransaction)]
    pub fn begin_transaction(&mut self) -> Result<TransactionHandle, JsValue> {
        let state = std::mem::replace(&mut self.state, StoreHandleState::Moved);
        let store = match state {
            StoreHandleState::Ready(store) => store,
            state @ StoreHandleState::Uninitialized { .. } => {
                self.state = state;
                return Err(js_error("store handle has not been initialized"));
            }
            StoreHandleState::Moved => {
                return Err(js_error(
                    "store handle has already been moved into a transaction",
                ));
            }
        };

        Ok(TransactionHandle {
            tx: Some(store.into_transaction()),
            recovered_store: None,

            pending_handles: Vec::new(),
        })
    }
}

#[wasm_bindgen]
impl StoreHandle {
    // For automerge-repo interfacing

    pub fn heads(&self) -> Result<Vec<CommitHash>, JsValue> {
        let heads = match &self.state {
            StoreHandleState::Uninitialized { .. } => return Ok(Vec::new()),
            StoreHandleState::Ready(store) => store,
            StoreHandleState::Moved => {
                return Err(js_error(
                    "store handle has already been moved into a transaction",
                ));
            }
        }
        .heads()
        .into_iter()
        .map(CommitHash::from)
        .collect::<Vec<_>>();

        Ok(heads)
    }

    #[wasm_bindgen(js_name = commitChunksAfter)]
    pub fn commit_chunks_after(
        &self,
        have_heads: Vec<CommitHash>,
    ) -> Result<Vec<CommitChunk>, JsValue> {
        if matches!(self.state, StoreHandleState::Uninitialized { .. }) {
            return Ok(Vec::new());
        }
        let have_heads = have_heads
            .into_iter()
            .map(StoreCommitHash::try_from)
            .collect::<Result<Vec<_>, _>>()
            .map_err(js_error)?;

        let chunks = self
            .store()?
            .commit_chunks_after(&have_heads)
            .into_iter()
            .map(CommitChunk::from)
            .collect::<Vec<_>>();

        Ok(chunks)
    }

    #[wasm_bindgen(js_name = applyChunkBytes)]
    pub fn apply_chunk_bytes(&mut self, chunk_bytes: JsValue) -> Result<(), JsValue> {
        let chunk_bytes =
            serde_wasm_bindgen::from_value::<Vec<Vec<u8>>>(chunk_bytes).map_err(js_error)?;
        self.apply_chunks(chunk_bytes)
    }
}

#[wasm_bindgen]
impl CommitResult {
    #[wasm_bindgen(getter)]
    pub fn commit(&self) -> String {
        self.commit.clone()
    }

    #[wasm_bindgen(js_name = takeStore)]
    pub fn take_store(&mut self) -> Result<StoreHandle, JsValue> {
        self.store
            .take()
            .ok_or_else(|| js_error("commit result store has already been taken"))
    }
}

impl StoreHandle {
    fn ready(store: Store) -> Self {
        Self {
            state: StoreHandleState::Ready(store),
        }
    }

    fn apply_chunks(&mut self, chunk_bytes: Vec<Vec<u8>>) -> Result<(), JsValue> {
        match &mut self.state {
            StoreHandleState::Uninitialized { chunks } => {
                let has_root = chunk_bytes
                    .iter()
                    .map(|bytes| Chunk::decode(bytes))
                    .collect::<Result<Vec<_>, _>>()
                    .map_err(js_error)?
                    .iter()
                    .any(Chunk::is_root);
                chunks.extend(chunk_bytes);
                if has_root {
                    let store = decode_commit_chunks(chunks.iter()).map_err(js_error)?;
                    self.state = StoreHandleState::Ready(store);
                }
                Ok(())
            }
            StoreHandleState::Ready(store) => {
                store.apply_chunk_bytes(chunk_bytes).map_err(js_error)
            }
            StoreHandleState::Moved => Err(js_error(
                "store handle has already been moved into a transaction",
            )),
        }
    }

    fn store(&self) -> Result<&Store, JsValue> {
        match &self.state {
            StoreHandleState::Uninitialized { .. } => {
                Err(js_error("store handle has not been initialized"))
            }
            StoreHandleState::Ready(store) => Ok(store),
            StoreHandleState::Moved => Err(js_error(
                "store handle has already been moved into a transaction",
            )),
        }
    }
}

impl TransactionHandle {
    fn tx(&mut self) -> Result<&mut OwnedTransaction, JsValue> {
        self.tx
            .as_mut()
            .ok_or_else(|| js_error("transaction has already been committed"))
    }
}

#[cfg(test)]
mod tests {
    use coln_flir_rs::ir::{
        BuiltinTy, ColType, ColumnEntry, EntityVariant, FlatRealm, Path, Schema, TableEntry,
    };

    use super::*;

    fn source_store() -> Store {
        let theory = FlatRealm {
            tables: vec![TableEntry {
                path: Path::from("T"),
                table: Schema {
                    entity_variant: EntityVariant::Table,
                    columns: vec![ColumnEntry {
                        path: Path::from("value"),
                        col_type: ColType::BuiltinTy {
                            builtin_ty: BuiltinTy::BuiltinInt,
                        },
                    }],
                    primary_key: None,
                },
            }],
            rules: vec![],
        };
        let mut store = Store::try_from_theory(theory).expect("store");
        let mut transaction = store.transaction();
        transaction
            .add(&Path::from("T"), vec![42_i64.into()])
            .expect("add row");
        transaction.commit().expect("commit");
        store
    }

    #[test]
    fn empty_handle_buffers_data_until_root_arrives() {
        let source = source_store();
        let (root, data): (Vec<_>, Vec<_>) = source
            .commit_chunks_after(&[])
            .into_iter()
            .map(|chunk| chunk.bytes)
            .partition(|bytes| Chunk::decode(bytes).expect("chunk").is_root());
        let mut handle = StoreHandle::empty();

        handle.apply_chunks(data).expect("buffer data");
        assert!(matches!(
            handle.state,
            StoreHandleState::Uninitialized { .. }
        ));
        assert!(handle.heads().expect("heads").is_empty());

        handle.apply_chunks(root).expect("apply root");
        let store = handle.store().expect("initialized store");
        let table = store.table_at(&Path::from("T")).expect("table");
        assert_eq!(table.row_count(), 1);
    }
}
