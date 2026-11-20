use serde::{Deserialize, Serialize};

use super::SecretId;

/// Public PBKDF2 parameters of an optional passphrase.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Passphrase {
    pub salt: Vec<u8>,
    pub iterations: u32,
}

/// One stored secret. Nothing here decrypts it: the key is in the link
/// fragment, and `auth_hash` only lets the holder of that key prove it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Secret {
    #[serde(with = "id_serde")]
    pub id: SecretId,
    pub ciphertext: Vec<u8>,
    pub iv: Vec<u8>,
    /// HKDF salt.
    pub salt: Vec<u8>,
    pub passphrase: Option<Passphrase>,
    /// SHA-256 of the client's proof of key.
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
}

mod id_serde {
    use serde::{Deserialize, Deserializer, Serializer, de::Error};

    use super::SecretId;

    pub fn serialize<S: Serializer>(id: &SecretId, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(id.as_str())
    }

    pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<SecretId, D::Error> {
        let raw = String::deserialize(d)?;
        raw.parse()
            .map_err(|()| D::Error::custom("invalid secret id"))
    }
}
