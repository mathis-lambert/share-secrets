use std::time::Duration;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

use crate::{
    domain::{Passphrase, SecretId, base64url},
    http::{
        AppState,
        error::ApiError,
        json::{ApiJson, no_store},
    },
    service::{NewSecret, ServiceError},
    storage::Store,
};

/// Malformed ids are indistinguishable from unknown ones.
fn secret_id(raw: &str) -> Result<SecretId, ApiError> {
    raw.parse().map_err(|()| ServiceError::NotFound.into())
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct CreateRequest {
    #[serde(with = "base64url")]
    ciphertext: Vec<u8>,
    #[serde(with = "base64url")]
    iv: Vec<u8>,
    #[serde(with = "base64url")]
    salt: Vec<u8>,
    passphrase: Option<Passphrase>,
    #[serde(with = "base64url")]
    auth: Vec<u8>,
    /// Seconds; must be one of the configured options.
    ttl: u64,
    views: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateResponse {
    id: SecretId,
    expires_at: u64,
}

pub async fn create<S: Store>(
    State(state): State<AppState<S>>,
    ApiJson(req): ApiJson<CreateRequest>,
) -> Result<Response, ApiError> {
    let created = state
        .service
        .create(NewSecret {
            ciphertext: req.ciphertext,
            iv: req.iv,
            salt: req.salt,
            passphrase: req.passphrase,
            auth: req.auth,
            ttl: Duration::from_secs(req.ttl),
            views: req.views,
        })
        .await?;
    let body = CreateResponse {
        id: created.id,
        expires_at: created.expires_at,
    };
    Ok((StatusCode::CREATED, no_store(body)).into_response())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectResponse {
    #[serde(with = "base64url")]
    salt: Vec<u8>,
    passphrase: Option<Passphrase>,
    expires_at: u64,
    views_left: u32,
}

pub async fn inspect<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let info = state.service.inspect(&secret_id(&id)?).await?;
    Ok(no_store(InspectResponse {
        salt: info.salt,
        passphrase: info.passphrase,
        expires_at: info.expires_at,
        views_left: info.views_left,
    }))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AuthRequest {
    #[serde(with = "base64url")]
    auth: Vec<u8>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RevealResponse {
    #[serde(with = "base64url")]
    ciphertext: Vec<u8>,
    #[serde(with = "base64url")]
    iv: Vec<u8>,
    views_left: u32,
}

pub async fn reveal<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    ApiJson(req): ApiJson<AuthRequest>,
) -> Result<Response, ApiError> {
    let out = state.service.reveal(&secret_id(&id)?, &req.auth).await?;
    Ok(no_store(RevealResponse {
        ciphertext: out.ciphertext,
        iv: out.iv,
        views_left: out.views_left,
    }))
}

pub async fn destroy<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    ApiJson(req): ApiJson<AuthRequest>,
) -> Result<StatusCode, ApiError> {
    state.service.destroy(&secret_id(&id)?, &req.auth).await?;
    Ok(StatusCode::NO_CONTENT)
}
