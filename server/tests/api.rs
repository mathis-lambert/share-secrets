//! End-to-end checks of the HTTP API, without a network socket.

use std::sync::Arc;

use axum::{
    Router,
    body::Body,
    http::{Request, StatusCode},
};
use http_body_util::BodyExt;
use serde_json::{Value, json};
use share_secrets::{
    config::Config,
    http::{AppState, router},
    service::{Limits, Service},
    storage::FileStore,
};
use tower::ServiceExt;

const B64_32: &str = "BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc"; // 32 × 0x07
const B64_16: &str = "AAAAAAAAAAAAAAAAAAAAAA";
const B64_12: &str = "AAAAAAAAAAAAAAAA";
const CIPHERTEXT: &str = "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB"; // 24 bytes

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
        Limits {
            max_secret_size: config.max_secret_size,
            ttl_options: config.ttl_options.clone(),
            max_views: config.max_views,
            max_failed_attempts: config.max_failed_attempts,
        },
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

    let (status, created) = call(
        &app,
        "POST",
        "/api/secrets",
        Some(json!({
            "ciphertext": CIPHERTEXT, "iv": B64_12, "salt": B64_16,
            "passphrase": null, "auth": B64_32, "ttl": 3600, "views": 1
        })),
    )
    .await;
    assert_eq!(status, StatusCode::CREATED, "{created}");
    let id = created["id"].as_str().unwrap();

    let (status, info) = call(&app, "GET", &format!("/api/secrets/{id}"), None).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(info["viewsLeft"], 1);

    let reveal = format!("/api/secrets/{id}/reveal");
    let (status, err) = call(&app, "POST", &reveal, Some(json!({ "auth": B64_16 }))).await;
    assert_eq!(
        (status, err["error"].as_str()),
        (StatusCode::FORBIDDEN, Some("wrong_key"))
    );

    let (status, out) = call(&app, "POST", &reveal, Some(json!({ "auth": B64_32 }))).await;
    assert_eq!(status, StatusCode::OK);
    assert_eq!(out["ciphertext"], CIPHERTEXT);

    let (status, _) = call(&app, "POST", &reveal, Some(json!({ "auth": B64_32 }))).await;
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

    let (status, _) = call(&app, "POST", "/api/secrets", Some(json!({ "nope": 1 }))).await;
    assert_eq!(status, StatusCode::BAD_REQUEST);

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
