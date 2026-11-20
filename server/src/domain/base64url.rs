//! `#[serde(with = "base64url")]` for byte fields: unpadded base64url strings,
//! the encoding of the API and of the file store.

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use serde::{Deserialize, Deserializer, Serializer, de::Error};

pub fn serialize<S: Serializer>(bytes: &[u8], s: S) -> Result<S::Ok, S::Error> {
    s.serialize_str(&URL_SAFE_NO_PAD.encode(bytes))
}

pub fn deserialize<'de, D: Deserializer<'de>>(d: D) -> Result<Vec<u8>, D::Error> {
    let s = String::deserialize(d)?;
    URL_SAFE_NO_PAD
        .decode(s.trim_end_matches('='))
        .map_err(|_| D::Error::custom("invalid base64url"))
}
