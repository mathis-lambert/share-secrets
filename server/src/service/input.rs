use std::time::Duration;

use super::{Limits, ServiceError};
use crate::domain::{AUTH_SIZE, GCM_TAG_SIZE, IV_SIZE, PBKDF2_ITERATIONS, Passphrase, SALT_SIZE};

/// An encrypted secret as sent by the client.
#[derive(Debug, Clone)]
pub struct NewSecret {
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    pub salt: Vec<u8>,
    pub passphrase: Option<Passphrase>,
    /// Proof of key; only its hash is stored.
    pub auth: Vec<u8>,
    pub ttl: Duration,
    pub views: u32,
}

impl NewSecret {
    pub(super) fn validate(&self, limits: &Limits) -> Result<(), ServiceError> {
        let invalid = |msg: String| Err(ServiceError::Invalid(msg));
        if self.ciphertext.len() <= GCM_TAG_SIZE {
            return invalid("ciphertext is empty".into());
        }
        if self.ciphertext.len() > limits.max_secret_size + GCM_TAG_SIZE {
            return invalid(format!("secret exceeds {} bytes", limits.max_secret_size));
        }
        if self.iv.len() != IV_SIZE {
            return invalid(format!("iv must be {IV_SIZE} bytes"));
        }
        if self.salt.len() != SALT_SIZE {
            return invalid(format!("salt must be {SALT_SIZE} bytes"));
        }
        if self.auth.len() != AUTH_SIZE {
            return invalid(format!("auth must be {AUTH_SIZE} bytes"));
        }
        if !limits.ttl_options.contains(&self.ttl) {
            return invalid("expiry is not one of the allowed options".into());
        }
        if !(1..=limits.max_views).contains(&self.views) {
            return invalid(format!("views must be between 1 and {}", limits.max_views));
        }
        if let Some(p) = &self.passphrase {
            if p.salt.len() != SALT_SIZE {
                return invalid(format!("passphrase salt must be {SALT_SIZE} bytes"));
            }
            if !PBKDF2_ITERATIONS.contains(&p.iterations) {
                return invalid("passphrase iterations out of range".into());
            }
        }
        Ok(())
    }
}
