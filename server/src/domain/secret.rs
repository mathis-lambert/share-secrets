use serde::{Deserialize, Serialize};

use super::{SecretId, base64url};

/// Public PBKDF2 parameters of an optional passphrase.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Passphrase {
    #[serde(with = "base64url")]
    pub salt: Vec<u8>,
    pub iterations: u32,
}

/// One stored secret. Nothing here decrypts it: the key is in the link
/// fragment, and `auth_hash` only lets the holder of that key prove it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Secret {
    pub id: SecretId,
    #[serde(with = "base64url")]
    pub ciphertext: Vec<u8>,
    #[serde(with = "base64url")]
    pub iv: Vec<u8>,
    /// HKDF salt.
    #[serde(with = "base64url")]
    pub salt: Vec<u8>,
    pub passphrase: Option<Passphrase>,
    /// SHA-256 of the client's proof of key.
    #[serde(with = "base64url")]
    pub auth_hash: Vec<u8>,
    /// Unix seconds.
    pub created_at: u64,
    /// Unix seconds.
    pub expires_at: u64,
    pub views_left: u32,
    pub failed_attempts: u32,
}

impl Secret {
    pub fn is_expired(&self, now: u64) -> bool {
        now >= self.expires_at
    }

    /// A valid secret expiring at `expires_at`, for storage tests.
    #[cfg(test)]
    pub(crate) fn fixture(expires_at: u64) -> Self {
        Self {
            id: SecretId::random(),
            ciphertext: vec![1; 32],
            iv: vec![0; super::IV_SIZE],
            salt: vec![0; super::SALT_SIZE],
            passphrase: Some(Passphrase {
                salt: vec![2; super::SALT_SIZE],
                iterations: 600_000,
            }),
            auth_hash: vec![3; 32],
            created_at: 1,
            expires_at,
            views_left: 2,
            failed_attempts: 0,
        }
    }
}
