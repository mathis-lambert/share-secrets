use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    process::ExitCode,
    sync::Arc,
    time::Duration,
};

use share_secrets::{
    config::{Config, format_duration},
    http::{AppState, router},
    service::{Limits, Service},
    storage::{Backend, FileStore, PostgresStore},
};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::try_from_env("LOG_LEVEL").unwrap_or_else(|_| "info".into()))
        .init();

    let config = match Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            tracing::error!(%e, "invalid configuration");
            return ExitCode::FAILURE;
        }
    };

    if std::env::args().nth(1).as_deref() == Some("healthcheck") {
        return healthcheck(config.listen_addr);
    }

    match serve(config).await {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            tracing::error!(%e, "server stopped");
            ExitCode::FAILURE
        }
    }
}

async fn serve(config: Config) -> Result<(), Box<dyn std::error::Error>> {
    let store = match &config.database_url {
        Some(url) => Backend::Postgres(PostgresStore::connect(url).await?),
        None => Backend::File(FileStore::open(&config.data_dir)?),
    };
    let backend = store.name();
    let service = Arc::new(Service::new(store, Limits::from(&config)));
    if !config.static_dir.join("index.html").is_file() {
        tracing::warn!(dir = %config.static_dir.display(), "web client not found");
    }

    tokio::spawn(sweep(service.clone(), config.sweep_interval));

    let listener = tokio::net::TcpListener::bind(config.listen_addr).await?;
    tracing::info!(
        addr = %config.listen_addr,
        ttl_options = ?config.ttl_options.iter().map(|d| format_duration(*d)).collect::<Vec<_>>(),
        max_views = config.max_views,
        trust_proxy = config.trust_proxy,
        storage = backend,
        "listening"
    );
    let app = router(AppState {
        service,
        config: Arc::new(config),
    });
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .with_graceful_shutdown(shutdown())
    .await?;
    Ok(())
}

/// Purges expired secrets so they do not linger on disk until someone asks.
async fn sweep(service: Arc<Service<Backend>>, every: Duration) {
    let mut ticker = tokio::time::interval(every);
    loop {
        ticker.tick().await;
        match service.sweep().await {
            Ok(0) => {}
            Ok(n) => tracing::info!(removed = n, "expired secrets purged"),
            Err(e) => tracing::error!(%e, "sweep failed"),
        }
    }
}

async fn shutdown() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let term = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let term = std::future::pending::<()>();
    tokio::select! { () = ctrl_c => {}, () = term => {} }
    tracing::info!("shutting down");
}

/// `share-secrets healthcheck`: for container health probes, which have no
/// curl or wget in a distroless image.
fn healthcheck(addr: SocketAddr) -> ExitCode {
    let port = addr.port();
    let probe = || -> std::io::Result<bool> {
        let mut stream =
            TcpStream::connect_timeout(&([127, 0, 0, 1], port).into(), Duration::from_secs(3))?;
        stream.set_read_timeout(Some(Duration::from_secs(3)))?;
        stream
            .write_all(b"GET /healthz HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n")?;
        let mut head = [0u8; 12];
        stream.read_exact(&mut head)?;
        Ok(head.ends_with(b"200"))
    };
    match probe() {
        Ok(true) => ExitCode::SUCCESS,
        _ => ExitCode::FAILURE,
    }
}
