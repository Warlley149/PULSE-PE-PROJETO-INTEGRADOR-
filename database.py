import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

DB_PATH = Path(__file__).parent / "pulse_pe.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                cpf TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                matricula TEXT DEFAULT '',
                password_hash TEXT NOT NULL,
                face_fingerprint_id TEXT NOT NULL UNIQUE,
                face_embedding_json TEXT NOT NULL,
                face_hash_sha256 TEXT NOT NULL,
                face_quality_score REAL NOT NULL,
                face_image_data_url TEXT NOT NULL,
                face_locked INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
            (email.strip(),),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_cpf(cpf: str) -> Optional[dict[str, Any]]:
    digits = "".join(ch for ch in cpf if ch.isdigit())
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE REPLACE(REPLACE(cpf, '.', ''), '-', '') = ?",
            (digits,),
        ).fetchone()
        return dict(row) if row else None


def list_all_embeddings() -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, nome, email, cpf, face_fingerprint_id, face_embedding_json FROM users"
        ).fetchall()
        result: list[dict[str, Any]] = []
        for row in rows:
            item = dict(row)
            item["embedding"] = json.loads(item["face_embedding_json"])
            result.append(item)
        return result


def create_user_with_biometrics(
    *,
    user_id: str,
    nome: str,
    cpf: str,
    email: str,
    matricula: str,
    password: str,
    face_fingerprint_id: str,
    face_embedding: list[float],
    face_hash_sha256: str,
    face_quality_score: float,
    face_image_data_url: str,
) -> dict[str, Any]:
    created_at = datetime.now(timezone.utc).isoformat()
    email_norm = email.strip().lower()
    pwd_hash = hash_password(password, email_norm)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (
                id, nome, cpf, email, matricula, password_hash,
                face_fingerprint_id, face_embedding_json, face_hash_sha256,
                face_quality_score, face_image_data_url, face_locked, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            """,
            (
                user_id,
                nome.strip(),
                cpf.strip(),
                email_norm,
                matricula.strip(),
                pwd_hash,
                face_fingerprint_id,
                json.dumps(face_embedding),
                face_hash_sha256,
                round(face_quality_score, 1),
                face_image_data_url,
                created_at,
            ),
        )
        conn.commit()

    return get_user_by_email(email_norm)  # type: ignore[return-value]


def authenticate_user(email: str, password: str) -> Optional[dict[str, Any]]:
    user = get_user_by_email(email)
    if not user:
        return None
    expected = hash_password(password, user["email"].lower())
    if expected != user["password_hash"]:
        return None
    return user

