use axum::{
    Json,
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use serde::Serialize;

use crate::service::ServiceError;

/// An error as returned to clients: `{"error": code, "message": text}`.
#[derive(Debug)]
pub struct ApiError {
    status: StatusCode,
    code: &'static str,
    message: String,
}

#[derive(Serialize)]
struct Body<'a> {
    error: &'a str,
    message: &'a str,
}

impl ApiError {
    pub fn new(status: StatusCode, code: &'static str, message: impl Into<String>) -> Self {
        Self {
            status,
            code,
            message: message.into(),
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(StatusCode::BAD_REQUEST, "invalid_request", message)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, "not_found", message)
    }

    /// Logs the cause and hides it from the client.
    pub fn internal(cause: impl std::fmt::Display) -> Self {
        tracing::error!(%cause, "request failed");
        Self::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            "internal",
            "Something went wrong.",
        )
    }
}

impl From<ServiceError> for ApiError {
    fn from(e: ServiceError) -> Self {
        match e {
            ServiceError::Invalid(msg) => Self::bad_request(msg),
            ServiceError::NotFound => {
                Self::not_found("This secret does not exist, has expired or was already read.")
            }
            ServiceError::WrongKey => Self::new(
                StatusCode::FORBIDDEN,
                "wrong_key",
                "The key or passphrase is wrong.",
            ),
            ServiceError::Storage(e) => Self::internal(e),
        }
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let body = Body {
            error: self.code,
            message: &self.message,
        };
        (
            self.status,
            [(header::CACHE_CONTROL, "no-store")],
            Json(body),
        )
            .into_response()
    }
}
