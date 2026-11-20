use super::{Action, FileStore, PostgresStore, StorageError, Store};
use crate::domain::{Secret, SecretId};

/// The backend chosen at startup.
pub enum Backend {
    File(FileStore),
    Postgres(PostgresStore),
}

impl Backend {
    pub fn name(&self) -> &'static str {
        match self {
            Self::File(_) => "file",
            Self::Postgres(_) => "postgres",
        }
    }
}

impl Store for Backend {
    async fn create(&self, secret: &Secret) -> Result<(), StorageError> {
        match self {
            Self::File(s) => s.create(secret).await,
            Self::Postgres(s) => s.create(secret).await,
        }
    }

    async fn get(&self, id: &SecretId) -> Result<Secret, StorageError> {
        match self {
            Self::File(s) => s.get(id).await,
            Self::Postgres(s) => s.get(id).await,
        }
    }

    async fn update<T, E, F>(&self, id: &SecretId, f: F) -> Result<Result<T, E>, StorageError>
    where
        T: Send,
        E: Send,
        F: FnOnce(&mut Secret) -> (Action, Result<T, E>) + Send,
    {
        match self {
            Self::File(s) => s.update(id, f).await,
            Self::Postgres(s) => s.update(id, f).await,
        }
    }

    async fn delete_expired(&self, now: u64) -> Result<u64, StorageError> {
        match self {
            Self::File(s) => s.delete_expired(now).await,
            Self::Postgres(s) => s.delete_expired(now).await,
        }
    }
}
