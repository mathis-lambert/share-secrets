use std::sync::{
    Arc,
    atomic::{AtomicU64, Ordering},
};

use super::*;
use crate::{
    domain::{AUTH_SIZE, IV_SIZE, SALT_SIZE},
    storage::FileStore,
};

const AUTH: [u8; AUTH_SIZE] = [7; AUTH_SIZE];
const BAD: [u8; AUTH_SIZE] = [9; AUTH_SIZE];

struct Harness {
    svc: Service<FileStore>,
    now: Arc<AtomicU64>,
    _dir: tempfile::TempDir,
}

fn harness() -> Harness {
    let dir = tempfile::tempdir().unwrap();
    let now = Arc::new(AtomicU64::new(1_000));
    let clock = now.clone();
    let svc = Service::with_clock(
        FileStore::open(dir.path()).unwrap(),
        Limits {
            max_secret_size: 100,
            ttl_options: vec![Duration::from_secs(3_600)],
            max_views: 5,
            max_failed_attempts: 3,
        },
        Arc::new(move || clock.load(Ordering::SeqCst)),
    );
    Harness {
        svc,
        now,
        _dir: dir,
    }
}

fn input(views: u32) -> NewSecret {
    NewSecret {
        ciphertext: vec![1; 40],
        iv: vec![0; IV_SIZE],
        salt: vec![0; SALT_SIZE],
        passphrase: None,
        auth: AUTH.to_vec(),
        ttl: Duration::from_secs(3_600),
        views,
    }
}

#[tokio::test]
async fn burns_after_last_view() {
    let h = harness();
    let id = h.svc.create(input(2)).await.unwrap().id;
    assert_eq!(h.svc.reveal(&id, &AUTH).await.unwrap().views_left, 1);
    let last = h.svc.reveal(&id, &AUTH).await.unwrap();
    assert_eq!((last.views_left, last.ciphertext.len()), (0, 40));
    assert!(matches!(
        h.svc.reveal(&id, &AUTH).await,
        Err(ServiceError::NotFound)
    ));
}

#[tokio::test]
async fn wrong_keys_destroy_after_limit() {
    let h = harness();
    let id = h.svc.create(input(1)).await.unwrap().id;
    for _ in 0..2 {
        assert!(matches!(
            h.svc.reveal(&id, &BAD).await,
            Err(ServiceError::WrongKey)
        ));
    }
    assert!(h.svc.inspect(&id).await.is_ok(), "destroyed too early");
    let _ = h.svc.reveal(&id, &BAD).await;
    assert!(matches!(
        h.svc.reveal(&id, &AUTH).await,
        Err(ServiceError::NotFound)
    ));
}

#[tokio::test]
async fn expires() {
    let h = harness();
    let id = h.svc.create(input(1)).await.unwrap().id;
    h.now.fetch_add(3_600, Ordering::SeqCst);
    assert!(matches!(
        h.svc.inspect(&id).await,
        Err(ServiceError::NotFound)
    ));
    assert_eq!(h.svc.sweep().await.unwrap(), 1);
}

#[tokio::test]
async fn destroy_requires_key() {
    let h = harness();
    let id = h.svc.create(input(3)).await.unwrap().id;
    assert!(matches!(
        h.svc.destroy(&id, &BAD).await,
        Err(ServiceError::WrongKey)
    ));
    h.svc.destroy(&id, &AUTH).await.unwrap();
    assert!(matches!(
        h.svc.inspect(&id).await,
        Err(ServiceError::NotFound)
    ));
}

#[tokio::test]
async fn validates_input() {
    let h = harness();
    let cases: [fn(&mut NewSecret); 7] = [
        |s| s.ciphertext = vec![0; 200],
        |s| s.ciphertext = vec![0; 16],
        |s| s.iv.clear(),
        |s| s.ttl = Duration::from_secs(7_200),
        |s| s.views = 6,
        |s| s.auth.truncate(5),
        |s| {
            s.passphrase = Some(Passphrase {
                salt: vec![0; SALT_SIZE],
                iterations: 10,
            })
        },
    ];
    for (i, mutate) in cases.into_iter().enumerate() {
        let mut s = input(1);
        mutate(&mut s);
        assert!(
            matches!(h.svc.create(s).await, Err(ServiceError::Invalid(_))),
            "case {i}"
        );
    }
}
