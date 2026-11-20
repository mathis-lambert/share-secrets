//! JSON in and out, with the API's own error shape and caching rules.

use axum::{
    Json,
    extract::{FromRequest, Request, rejection::JsonRejection},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::{Serialize, de::DeserializeOwned};

use super::error::ApiError;

/// `axum::Json`, but rejections (malformed body, wrong content type, body
/// over the size limit) come back as [`ApiError`] like every other failure.
pub struct ApiJson<T>(pub T);

impl<T: DeserializeOwned, S: Send + Sync> FromRequest<S> for ApiJson<T> {
    type Rejection = ApiError;

    async fn from_request(req: Request, state: &S) -> Result<Self, ApiError> {
        Json::<T>::from_request(req, state)
            .await
            .map(|Json(value)| Self(value))
            .map_err(ApiError::from)
    }
}

impl From<JsonRejection> for ApiError {
    fn from(rejection: JsonRejection) -> Self {
        let status = rejection.status();
        if status == StatusCode::PAYLOAD_TOO_LARGE {
            ApiError::new(status, "too_large", "Request body is too large.")
        } else {
            ApiError::new(status, "invalid_request", rejection.body_text())
        }
    }
}

/// A JSON response that proxies and browsers must not cache. Every API
/// response, errors included, goes through here.
pub fn no_store<T: Serialize>(value: T) -> Response {
    ([(header::CACHE_CONTROL, "no-store")], Json(value)).into_response()
}
