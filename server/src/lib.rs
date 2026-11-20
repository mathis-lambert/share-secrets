//! Share Secrets: end-to-end encrypted, self-destructing secret sharing.
//!
//! The browser encrypts every secret before upload. The key travels in the
//! link fragment, which browsers never send to the server, so this crate only
//! ever stores and returns ciphertext.

pub mod config;
pub mod domain;
pub mod http;
pub mod service;
pub mod storage;
pub mod web;
