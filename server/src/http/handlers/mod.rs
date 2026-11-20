pub mod meta;
pub mod secrets;

use axum::{
    Json,
    body::Bytes,
    http::header,
    response::{IntoResponse, Response},
};
use serde::{Serialize, de::DeserializeOwned};

use super::error::ApiError;

/// Parses a JSON body, with our own error shape instead of axum's.
fn parse<T: DeserializeOwned>(body: &Bytes) -> Result<T, ApiError> {
    serde_json::from_slice(body).map_err(|e| ApiError::bad_request(format!("Malformed body: {e}")))
}

/// A JSON response that proxies and browsers must not cache.
fn no_store<T: Serialize>(value: T) -> Response {
    ([(header::CACHE_CONTROL, "no-store")], Json(value)).into_response()
}
