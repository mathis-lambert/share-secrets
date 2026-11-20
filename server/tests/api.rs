//! End-to-end checks of the HTTP API, without a network socket.

use std::sync::Arc;

use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use share_secrets::{
    config::Config,
    domain::{AUTH_SIZE, IV_SIZE, SALT_SIZE},
    http::{AppState, router},
    service::{Limits, Service},
    storage::FileStore,
};
use tower::ServiceExt;

/// Unpadded base64url of `len` copies of `byte`, as the client sends it.
fn b64(byte: u8, len: usize) -> String {
    URL_SAFE_NO_PAD.encode(vec![byte; len])
}

fn app(dir: &tempfile::TempDir) -> Router {
    let config = Config::from_lookup(|k| match k {
        "DATA_DIR" => Some(dir.path().display().to_string()),
        "STATIC_DIR" => Some(dir.path().join("web").display().to_string()),
        "RATE_LIMIT" => Some("0".into()),
        _ => None,
    })
    .unwrap();
    let service = Service::new(
        FileStore::open(&config.data_dir).unwrap(),
        Limits::from(&config),
    );
    router(AppState {
        service: Arc::new(service),
        config: Arc::new(config),
    })
}

async fn call(app: &Router, method: &str, uri: &str, body: Option<Value>) -> (StatusCode, Value) {
    let req = Request::builder()
        .method(method)
        .uri(uri)
        .header("content-type", "application/json")
        .body(body.map_or_else(Body::empty, |b| Body::from(b.to_string())))
        .unwrap();
    let res = app.clone().oneshot(req).await.unwrap();
    let status = res.status();
    let bytes = res.into_body().collect().await.unwrap().to_bytes();
    (
        status,
        serde_json::from_slice(&bytes).unwrap_or(Value::Null),
    )
}

#[tokio::test]
async fn create_inspect_reveal_burn() {
    let dir = tempfile::tempdir().unwrap();
    let app = app(&dir);
    let (ciphertext, auth) = (b64(1, 24), b64(7, AUTH_SIZE));

    let (status, created) = call(
        &app,
        "POST",
        "/api/secrets",
        Some(json!({
            "ciphertext": ciphertext, "iv": b64(0, IV_SIZE), "salt": b64(0, SALT_SIZE),
            "passphrase": null, "auth": auth, "ttl": 3600, "views": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let (status, info) = call(&app, "GET", &format!("/api/secrets/{id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(info["viewsLeft"], 1);

    let reveal = format!("/api/secrets/{id}/reveal");
    let (status, err) = call(
        &app,
        "POST",
        &reveal,
        Some(json!({ "auth": b64(9, AUTH_SIZE) })),
    )
    .await;
    assert_eq!(
        (status, err["error"].as_str()),
        (StatusCode::FORBIDDEN, Some("wrong_key"))
    );

    let (status, out) = call(&app, "POST", &reveal, Some(json!({ "auth": auth }))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(out["ciphertext"], ciphertext);

    let (status, _) = call(&app, "POST", &reveal, Some(json!({ "auth": auth }))).await;
    assert_eq!(
        status,
        StatusCode::NOT_FOUND,
        "secret must burn after reading"
    );
}

#[tokio::test]
async fn rejects_bad_requests() {
    let dir = tempfile::tempdir().unwrap();
    let app = app(&dir);

    let (status, err) = call(&app, "POST", "/api/secrets", Some(json!({ "nope": 1 }))).await;
    assert_eq!(status, StatusCode::UNPROCESSABLE_ENTITY);
    assert_eq!(err["error"], "invalid_request");

    let huge = json!({ "ciphertext": "A".repeat(200_000) });
    let (status, err) = call(&app, "POST", "/api/secrets", Some(huge)).await;
    assert_eq!(status, StatusCode::PAYLOAD_TOO_LARGE);
    assert_eq!(err["error"], "too_large");

    let (status, _) = call(&app, "GET", "/api/secrets/..%2F..%2Fetc", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);

    let (status, _) = call(&app, "GET", "/api/unknown", None).await;
    assert_eq!(status, StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn sets_security_headers() {
    let dir = tempfile::tempdir().unwrap();
    let res = app(&dir)
        .oneshot(Request::get("/healthz").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(res.status(), StatusCode::OK);
    let csp = res.headers()["content-security-policy"].to_str().unwrap();
    assert!(csp.contains("frame-ancestors 'none'"));
    assert_eq!(res.headers()["referrer-policy"], "no-referrer");
}
