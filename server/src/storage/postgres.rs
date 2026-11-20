//! PostgreSQL storage. Updates lock the row (`SELECT … FOR UPDATE`) inside a
//! transaction, so two concurrent reveals cannot both consume the last read.

use std::time::Duration;

use sqlx::{
    PgPool, Postgres, Row, Transaction,
    postgres::{PgPoolOptions, PgRow},
};

use super::{Action, StorageError, Store};
use crate::domain::{Passphrase, Secret, SecretId};

static MIGRATIONS: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

/// Column list, as a macro so queries stay static string literals.
macro_rules! columns {
    () => {
        "id, ciphertext, iv, salt, passphrase_salt, passphrase_iterations, \
         auth_hash, created_at, expires_at, views_left, failed_attempts"
    };
}

#[derive(Clone)]
pub struct PostgresStore {
    pool: PgPool,
}

impl PostgresStore {
    /// Connects and brings the schema up to date.
    pub async fn connect(url: &str) -> Result<Self, StorageError> {
        let pool = PgPoolOptions::new()
            .max_connections(5)
            .acquire_timeout(Duration::from_secs(5))
            .connect(url)
            .await?;
        MIGRATIONS
            .run(&pool)
            .await
            .map_err(|e| StorageError::Database(e.into()))?;
        Ok(Self { pool })
    }
}

fn from_row(row: &PgRow) -> Result<Secret, StorageError> {
    let id: String = row.try_get("id")?;
    let passphrase = match (
        row.try_get::<Option<Vec<u8>>, _>("passphrase_salt")?,
        row.try_get::<Option<i32>, _>("passphrase_iterations")?,
    ) {
        (Some(salt), Some(iterations)) => Some(Passphrase {
            salt,
            iterations: iterations as u32,
        }),
        _ => None,
    };
    Ok(Secret {
        id: id
            .parse()
            .map_err(|()| StorageError::Corrupt(format!("invalid id {id:?}")))?,
        ciphertext: row.try_get("ciphertext")?,
        iv: row.try_get("iv")?,
        salt: row.try_get("salt")?,
        passphrase,
        auth_hash: row.try_get("auth_hash")?,
        created_at: row.try_get::<i64, _>("created_at")? as u64,
        expires_at: row.try_get::<i64, _>("expires_at")? as u64,
        views_left: row.try_get::<i32, _>("views_left")? as u32,
        failed_attempts: row.try_get::<i32, _>("failed_attempts")? as u32,
    })
}

async fn locked(tx: &mut Transaction<'_, Postgres>, id: &SecretId) -> Result<Secret, StorageError> {
    let row = sqlx::query(concat!(
        "SELECT ",
        columns!(),
        " FROM secrets WHERE id = $1 FOR UPDATE"
    ))
    .bind(id.as_str())
    .fetch_optional(&mut **tx)
    .await?
    .ok_or(StorageError::NotFound)?;
    from_row(&row)
}

impl Store for PostgresStore {
    async fn create(&self, s: &Secret) -> Result<(), StorageError> {
        let inserted = sqlx::query(concat!(
            "INSERT INTO secrets (",
            columns!(),
            ") VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT (id) DO NOTHING"
        ))
        .bind(s.id.as_str())
        .bind(&s.ciphertext)
        .bind(&s.iv)
        .bind(&s.salt)
        .bind(s.passphrase.as_ref().map(|p| p.salt.as_slice()))
        .bind(s.passphrase.as_ref().map(|p| p.iterations as i32))
        .bind(&s.auth_hash)
        .bind(s.created_at as i64)
        .bind(s.expires_at as i64)
        .bind(s.views_left as i32)
        .bind(s.failed_attempts as i32)
        .execute(&self.pool)
        .await?;
        if inserted.rows_affected() == 0 {
            return Err(StorageError::Conflict);
        }
        Ok(())
    }

    async fn get(&self, id: &SecretId) -> Result<Secret, StorageError> {
        let row = sqlx::query(concat!(
            "SELECT ",
            columns!(),
            " FROM secrets WHERE id = $1"
        ))
        .bind(id.as_str())
        .fetch_optional(&self.pool)
        .await?
        .ok_or(StorageError::NotFound)?;
        from_row(&row)
    }

    async fn update<T, E, F>(&self, id: &SecretId, f: F) -> Result<Result<T, E>, StorageError>
    where
        T: Send,
        E: Send,
        F: FnOnce(&mut Secret) -> (Action, Result<T, E>) + Send,
    {
        let mut tx = self.pool.begin().await?;
        let mut secret = locked(&mut tx, id).await?;
        let (action, outcome) = f(&mut secret);
        match action {
            Action::Save => {
                // Only counters change after creation.
                sqlx::query(
                    "UPDATE secrets SET views_left = $2, failed_attempts = $3 WHERE id = $1",
                )
                .bind(id.as_str())
                .bind(secret.views_left as i32)
                .bind(secret.failed_attempts as i32)
                .execute(&mut *tx)
                .await?;
            }
            Action::Remove => {
                sqlx::query("DELETE FROM secrets WHERE id = $1")
                    .bind(id.as_str())
                    .execute(&mut *tx)
                    .await?;
            }
        }
        tx.commit().await?;
        Ok(outcome)
    }

    async fn delete_expired(&self, now: u64) -> Result<u64, StorageError> {
        let done = sqlx::query("DELETE FROM secrets WHERE expires_at <= $1")
            .bind(now as i64)
            .execute(&self.pool)
            .await?;
        Ok(done.rows_affected())
    }
}

/// Runs against a real database when `TEST_DATABASE_URL` is set (CI does).
#[cfg(test)]
mod tests {
    use super::*;

    async fn store() -> Option<PostgresStore> {
        let url = std::env::var("TEST_DATABASE_URL").ok()?;
        Some(PostgresStore::connect(&url).await.expect("connect"))
    }

    #[tokio::test]
    async fn lifecycle() {
        let Some(store) = store().await else { return };
        let s = Secret::fixture(u64::MAX >> 2);
        store.create(&s).await.unwrap();
        assert!(matches!(
            store.create(&s).await,
            Err(StorageError::Conflict)
        ));
        assert_eq!(store.get(&s.id).await.unwrap().passphrase, s.passphrase);

        let outcome = store
            .update(&s.id, |x| {
                x.failed_attempts += 1;
                (Action::Save, Err::<(), _>("wrong key"))
            })
            .await
            .unwrap();
        assert!(outcome.is_err());
        assert_eq!(store.get(&s.id).await.unwrap().failed_attempts, 1);

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
    async fn delete_expired() {
        let Some(store) = store().await else { return };
        let (live, dead) = (Secret::fixture(u64::MAX >> 2), Secret::fixture(5));
        store.create(&live).await.unwrap();
        store.create(&dead).await.unwrap();
        assert!(store.delete_expired(10).await.unwrap() >= 1);
        assert!(store.get(&live.id).await.is_ok());
        assert!(matches!(
            store.get(&dead.id).await,
            Err(StorageError::NotFound)
        ));
    }
}
