//! Persistence of secrets.
//!
//! Two backends behind one trait: PostgreSQL when `DATABASE_URL` is set, and a
//! directory of JSON files otherwise, so a single container works out of the box.

mod backend;
mod file;
mod postgres;

use std::future::Future;

pub use backend::Backend;
pub use file::FileStore;
pub use postgres::PostgresStore;

use crate::domain::{Secret, SecretId};

#[derive(Debug, thiserror::Error)]
pub enum StorageError {
    #[error("secret not found")]
    NotFound,
    #[error("secret already exists")]
    Conflict,
    #[error(transparent)]
    Io(#[from] std::io::Error),
    /// A stored record that cannot be decoded; logged, never served.
    #[error("corrupt record: {0}")]
    Corrupt(String),
    #[error(transparent)]
    Database(#[from] sqlx::Error),
}

impl From<serde_json::Error> for StorageError {
    fn from(e: serde_json::Error) -> Self {
        Self::Corrupt(e.to_string())
    }
}

/// What [`Store::update`] does with the secret once the callback returns.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Action {
    /// Persist the modified secret.
    Save,
    /// Delete the secret.
    Remove,
}

/// Storage backend. Implementations must make `update` atomic: nothing else
/// may observe or change the secret between the read and the action.
pub trait Store: Send + Sync + 'static {
    /// Stores a new secret; its id must be unused.
    fn create(&self, secret: &Secret) -> impl Future<Output = Result<(), StorageError>> + Send;

    fn get(&self, id: &SecretId) -> impl Future<Output = Result<Secret, StorageError>> + Send;

    /// Loads the secret, runs `f`, then applies the returned action — even
    /// when `f` also yields an error, so failures can still be recorded.
    fn update<T, E, F>(
        &self,
        id: &SecretId,
        f: F,
    ) -> impl Future<Output = Result<Result<T, E>, StorageError>> + Send
    where
        T: Send,
        E: Send,
        F: FnOnce(&mut Secret) -> (Action, Result<T, E>) + Send;

    /// Removes every secret expired at `now` (unix seconds); returns the count.
    fn delete_expired(&self, now: u64) -> impl Future<Output = Result<u64, StorageError>> + Send;
}
