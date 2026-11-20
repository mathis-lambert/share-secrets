//! One JSON file per secret in a directory: the zero-setup backend.
//!
//! Suits a single instance. A mutex serialises every operation and files are
//! replaced atomically (write to a temporary file, fsync, rename). Each call
//! is a few small local file operations with no await while the lock is held,
//! so they run inline rather than on the blocking pool.

use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
    sync::Mutex,
};

use super::{Action, StorageError, Store};
use crate::domain::{Secret, SecretId};

const TMP_PREFIX: &str = ".tmp-";

pub struct FileStore {
    dir: PathBuf,
    lock: Mutex<()>,
}

impl FileStore {
    /// Opens (and creates, mode 0700) `<data_dir>/secrets`.
    pub fn open(data_dir: &Path) -> io::Result<Self> {
        let dir = data_dir.join("secrets");
        fs::create_dir_all(&dir)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&dir, fs::Permissions::from_mode(0o700))?;
        }
        Ok(Self {
            dir,
            lock: Mutex::new(()),
        })
    }

    fn path(&self, id: &SecretId) -> PathBuf {
        // SecretId only admits [A-Za-z0-9_-], so this cannot escape `dir`.
        self.dir.join(format!("{id}.json"))
    }

    fn guard(&self) -> std::sync::MutexGuard<'_, ()> {
        // A panic while holding the lock leaves no partial state on disk
        // (writes are atomic), so a poisoned lock is safe to reuse.
        self.lock.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn write(&self, path: &Path, secret: &Secret) -> Result<(), StorageError> {
        let data = serde_json::to_vec(secret)?;
        let tmp = self.dir.join(format!("{TMP_PREFIX}{}", SecretId::random()));
        let result = (|| {
            let mut file = fs::File::create_new(&tmp)?;
            file.write_all(&data)?;
            file.sync_all()?;
            fs::rename(&tmp, path)
        })();
        if result.is_err() {
            let _ = fs::remove_file(&tmp);
        }
        Ok(result?)
    }
}

fn read(path: &Path) -> Result<Secret, StorageError> {
    match fs::read(path) {
        Ok(data) => Ok(serde_json::from_slice(&data)?),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Err(StorageError::NotFound),
        Err(e) => Err(e.into()),
    }
}

impl Store for FileStore {
    async fn create(&self, secret: &Secret) -> Result<(), StorageError> {
        let _guard = self.guard();
        let path = self.path(&secret.id);
        if path.exists() {
            return Err(StorageError::Conflict);
        }
        self.write(&path, secret)
    }

    async fn get(&self, id: &SecretId) -> Result<Secret, StorageError> {
        let _guard = self.guard();
        read(&self.path(id))
    }

    async fn update<T, E, F>(&self, id: &SecretId, f: F) -> Result<Result<T, E>, StorageError>
    where
        T: Send,
        E: Send,
        F: FnOnce(&mut Secret) -> (Action, Result<T, E>) + Send,
    {
        let _guard = self.guard();
        let path = self.path(id);
        let mut secret = read(&path)?;
        let (action, outcome) = f(&mut secret);
        match action {
            Action::Save => self.write(&path, &secret)?,
            Action::Remove => fs::remove_file(&path)?,
        }
        Ok(outcome)
    }

    async fn delete_expired(&self, now: u64) -> Result<u64, StorageError> {
        let mut removed = 0;
        for entry in fs::read_dir(&self.dir)? {
            let path = entry?.path();
            // Lock per file, not for the whole scan, so requests can
            // interleave with a long sweep.
            let _guard = self.guard();
            let name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or_default();
            if name.starts_with(TMP_PREFIX) {
                // Left behind by a crash mid-write.
                let _ = fs::remove_file(&path);
                continue;
            }
            if !name.ends_with(".json") {
                continue;
            }
            // Unreadable records can never be served: drop them too.
            let stale = read(&path).map_or(true, |s| s.is_expired(now));
            if stale && fs::remove_file(&path).is_ok() {
                removed += 1;
            }
        }
        Ok(removed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn lifecycle() {
        let dir = tempfile::tempdir().unwrap();
        let store = FileStore::open(dir.path()).unwrap();
        let s = Secret::fixture(100);
        store.create(&s).await.unwrap();
        assert!(matches!(
            store.create(&s).await,
            Err(StorageError::Conflict)
        ));

        let outcome = store
            .update(&s.id, |x| {
                x.failed_attempts += 1;
                (Action::Save, Err::<(), _>("wrong key"))
            })
            .await
            .unwrap();
        assert!(outcome.is_err());
        assert_eq!(
            store.get(&s.id).await.unwrap().failed_attempts,
            1,
            "save applied despite error"
        );

        store
            .update(&s.id, |_| (Action::Remove, Ok::<_, ()>(())))
            .await
            .unwrap()
            .unwrap();
        assert!(matches!(
            store.get(&s.id).await,
            Err(StorageError::NotFound)
        ));
    }

    #[tokio::test]
    async fn delete_expired_keeps_live_secrets() {
        let dir = tempfile::tempdir().unwrap();
        let store = FileStore::open(dir.path()).unwrap();
        let (live, dead) = (Secret::fixture(200), Secret::fixture(50));
        store.create(&live).await.unwrap();
        store.create(&dead).await.unwrap();
        fs::write(dir.path().join("secrets/.tmp-orphan"), b"").unwrap();

        assert_eq!(store.delete_expired(100).await.unwrap(), 1);
        assert!(store.get(&live.id).await.is_ok());
        assert_eq!(fs::read_dir(dir.path().join("secrets")).unwrap().count(), 1);
    }
}
