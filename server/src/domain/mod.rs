//! The stored secret and the sizes fixed by the client-side envelope.

mod id;
mod secret;

pub use id::SecretId;
pub use secret::{Passphrase, Secret};

/// AES-GCM nonce length.
pub const IV_SIZE: usize = 12;
/// HKDF and PBKDF2 salt length.
pub const SALT_SIZE: usize = 16;
/// Proof-of-key length (HKDF output).
pub const AUTH_SIZE: usize = 32;
/// AES-GCM authentication tag length.
pub const GCM_TAG_SIZE: usize = 16;
/// Accepted PBKDF2 iteration counts for passphrases.
pub const PBKDF2_ITERATIONS: std::ops::RangeInclusive<u32> = 100_000..=5_000_000;
