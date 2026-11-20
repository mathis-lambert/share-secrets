//! Byte strings carried as unpadded base64url in JSON.

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Deserializer, Serialize, Serializer, de::Error};

#[derive(Debug, Clone, Default)]
pub struct B64(pub Vec<u8>);

impl Serialize for B64 {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&URL_SAFE_NO_PAD.encode(&self.0))
    }
}

impl<'de> Deserialize<'de> for B64 {
    fn deserialize<D: Deserializer<'de>>(d: D) -> Result<Self, D::Error> {
        let s = String::deserialize(d)?;
        URL_SAFE_NO_PAD
            .decode(s.trim_end_matches('='))
            .map(B64)
            .map_err(|_| D::Error::custom("invalid base64url"))
    }
}
