//! The secret lifecycle: create, inspect, reveal, destroy, sweep.

mod error;
mod input;

use std::{
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

pub use error::ServiceError;
pub use input::NewSecret;

use crate::{
    config::Config,
    domain::{Passphrase, Secret, SecretId},
    storage::{Action, StorageError, Store},
};

/// Rules every secret must follow.
#[derive(Debug, Clone)]
pub struct Limits {
    pub max_secret_size: usize,
    pub ttl_options: Vec<Duration>,
    pub max_views: u32,
    pub max_failed_attempts: u32,
}

impl From<&Config> for Limits {
    fn from(c: &Config) -> Self {
        Self {
            max_secret_size: c.max_secret_size,
            ttl_options: c.ttl_options.clone(),
            max_views: c.max_views,
            max_failed_attempts: c.max_failed_attempts,
        }
    }
}

type Clock = Arc<dyn Fn() -> u64 + Send + Sync>;

pub struct Service<S> {
    store: S,
    limits: Limits,
    clock: Clock,
}

/// Public, non-consuming view of a secret: what a recipient needs to derive
/// the key before asking for the ciphertext.
#[derive(Debug)]
pub struct Info {
    pub salt: Vec<u8>,
    pub passphrase: Option<Passphrase>,
    pub expires_at: u64,
    pub views_left: u32,
}

/// Ciphertext handed to a recipient who proved the key.
#[derive(Debug)]
pub struct Revealed {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub views_left: u32,
}

#[derive(Debug)]
pub struct Created {
    pub id: SecretId,
    pub expires_at: u64,
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

fn sha256(bytes: &[u8]) -> Vec<u8> {
    Sha256::digest(bytes).to_vec()
}

impl<S: Store> Service<S> {
    pub fn new(store: S, limits: Limits) -> Self {
        Self::with_clock(store, limits, Arc::new(unix_now))
    }

    pub fn with_clock(store: S, limits: Limits, clock: Clock) -> Self {
        Self {
            store,
            limits,
            clock,
        }
    }

    pub async fn create(&self, input: NewSecret) -> Result<Created, ServiceError> {
        input.validate(&self.limits)?;
        let now = (self.clock)();
        let secret = Secret {
            id: SecretId::random(),
            ciphertext: input.ciphertext,
            iv: input.iv,
            salt: input.salt,
            passphrase: input.passphrase,
            auth_hash: sha256(&input.auth),
            created_at: now,
            expires_at: now + input.ttl.as_secs(),
            views_left: input.views,
            failed_attempts: 0,
        };
        self.store.create(&secret).await?;
        Ok(Created {
            id: secret.id,
            expires_at: secret.expires_at,
        })
    }

    pub async fn inspect(&self, id: &SecretId) -> Result<Info, ServiceError> {
        let secret = self.store.get(id).await?;
        if secret.is_expired((self.clock)()) {
            return Err(ServiceError::NotFound);
        }
        Ok(Info {
            salt: secret.salt,
            passphrase: secret.passphrase,
            expires_at: secret.expires_at,
            views_left: secret.views_left,
        })
    }

    /// Checks the proof of key, consumes one view and returns the ciphertext.
    /// The secret is deleted on its last view.
    pub async fn reveal(&self, id: &SecretId, auth: &[u8]) -> Result<Revealed, ServiceError> {
        self.store
            .update(id, |secret| {
                if let Err(denied) = self.authorize(secret, auth) {
                    return denied;
                }
                secret.views_left -= 1;
                let action = if secret.views_left == 0 {
                    Action::Remove
                } else {
                    Action::Save
                };
                // The last read deletes the record: move the bytes out instead of copying.
                let ciphertext = if action == Action::Remove {
                    std::mem::take(&mut secret.ciphertext)
                } else {
                    secret.ciphertext.clone()
                };
                let revealed = Revealed {
                    ciphertext,
                    iv: secret.iv.clone(),
                    views_left: secret.views_left,
                };
                (action, Ok(revealed))
            })
            .await?
    }

    /// Deletes a secret for anyone who proves the key, typically its sender.
    pub async fn destroy(&self, id: &SecretId, auth: &[u8]) -> Result<(), ServiceError> {
        self.store
            .update(id, |secret| match self.authorize(secret, auth) {
                Ok(()) => (Action::Remove, Ok(())),
                Err(denied) => denied,
            })
            .await?
    }

    /// On failure, returns the storage action recording it: drop expired
    /// secrets, count wrong keys, destroy the secret once they hit the limit.
    fn authorize<T>(
        &self,
        secret: &mut Secret,
        auth: &[u8],
    ) -> Result<(), (Action, Result<T, ServiceError>)> {
        if secret.is_expired((self.clock)()) {
            return Err((Action::Remove, Err(ServiceError::NotFound)));
        }
        if bool::from(sha256(auth).ct_eq(&secret.auth_hash)) {
            return Ok(());
        }
        secret.failed_attempts += 1;
        let action = if secret.failed_attempts >= self.limits.max_failed_attempts {
            Action::Remove
        } else {
            Action::Save
        };
        Err((action, Err(ServiceError::WrongKey)))
    }

    /// Purges expired secrets; returns how many were removed.
    pub async fn sweep(&self) -> Result<u64, StorageError> {
        self.store.delete_expired((self.clock)()).await
    }
}

#[cfg(test)]
mod tests;
