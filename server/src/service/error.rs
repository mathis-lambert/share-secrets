use crate::storage::StorageError;

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    /// The request breaks a rule; the message is safe to show.
    #[error("{0}")]
    Invalid(String),
    /// Unknown, expired, burnt or destroyed: callers cannot tell which.
    #[error("secret not found")]
    NotFound,
    /// The proof of key does not match.
    #[error("wrong key")]
    WrongKey,
    #[error(transparent)]
    Storage(StorageError),
}

impl From<StorageError> for ServiceError {
    fn from(e: StorageError) -> Self {
        match e {
            StorageError::NotFound => Self::NotFound,
            other => Self::Storage(other),
        }
    }
}
