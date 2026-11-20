use std::time::Duration;

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::{Deserialize, Serialize};

use super::{no_store, parse};
use crate::{
    domain::{Passphrase, SecretId},
    http::{AppState, b64::B64, error::ApiError},
    service::NewSecret,
    storage::Store,
};

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct PassphraseDto {
    salt: B64,
    iterations: u32,
}

impl From<PassphraseDto> for Passphrase {
    fn from(p: PassphraseDto) -> Self {
        Self {
            salt: p.salt.0,
            iterations: p.iterations,
        }
    }
}

impl From<Passphrase> for PassphraseDto {
    fn from(p: Passphrase) -> Self {
        Self {
            salt: B64(p.salt),
            iterations: p.iterations,
        }
    }
}

fn secret_id(raw: &str) -> Result<SecretId, ApiError> {
    raw.parse()
        .map_err(|()| ApiError::from(crate::service::ServiceError::NotFound))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateRequest {
    ciphertext: B64,
    iv: B64,
    salt: B64,
    passphrase: Option<PassphraseDto>,
    auth: B64,
    /// Seconds; must be one of the configured options.
    ttl: u64,
    views: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateResponse {
    id: String,
    expires_at: u64,
}

pub async fn create<S: Store>(
    State(state): State<AppState<S>>,
    body: Bytes,
) -> Result<Response, ApiError> {
    let req: CreateRequest = parse(&body)?;
    let input = NewSecret {
        ciphertext: req.ciphertext.0,
        iv: req.iv.0,
        salt: req.salt.0,
        passphrase: req.passphrase.map(Into::into),
        auth: req.auth.0,
        ttl: Duration::from_secs(req.ttl),
        views: req.views,
    };
    let created = state.service.create(input).await?;
    let body = CreateResponse {
        id: created.id.to_string(),
        expires_at: created.expires_at,
    };
    Ok((StatusCode::CREATED, no_store(body)).into_response())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct InspectResponse {
    salt: B64,
    passphrase: Option<PassphraseDto>,
    expires_at: u64,
    views_left: u32,
}

pub async fn inspect<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
) -> Result<Response, ApiError> {
    let id = secret_id(&id)?;
    let info = state.service.inspect(&id).await?;
    Ok(no_store(InspectResponse {
        salt: B64(info.salt),
        passphrase: info.passphrase.map(Into::into),
        expires_at: info.expires_at,
        views_left: info.views_left,
    }))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct AuthRequest {
    auth: B64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RevealResponse {
    ciphertext: B64,
    iv: B64,
    views_left: u32,
}

pub async fn reveal<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<Response, ApiError> {
    let id = secret_id(&id)?;
    let AuthRequest { auth } = parse(&body)?;
    let out = state.service.reveal(&id, &auth.0).await?;
    Ok(no_store(RevealResponse {
        ciphertext: B64(out.ciphertext),
        iv: B64(out.iv),
        views_left: out.views_left,
    }))
}

pub async fn destroy<S: Store>(
    State(state): State<AppState<S>>,
    Path(id): Path<String>,
    body: Bytes,
) -> Result<StatusCode, ApiError> {
    let id = secret_id(&id)?;
    let AuthRequest { auth } = parse(&body)?;
    state.service.destroy(&id, &auth.0).await?;
    Ok(StatusCode::NO_CONTENT)
}
