import base64
import hashlib
import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "pulse_pe.db"
FACES_DIR = BASE_DIR / "storage" / "faces"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                nome TEXT NOT NULL,
                cpf TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                matricula TEXT DEFAULT '',
                plano TEXT DEFAULT '',
                categoria TEXT DEFAULT '',
                membro_desde TEXT DEFAULT '',
                telefone TEXT DEFAULT '',
                documento_identificacao TEXT DEFAULT '',
                orgao_emissor TEXT DEFAULT '',
                acessibilidade TEXT DEFAULT '',
                alertas_portao INTEGER NOT NULL DEFAULT 1,
                catraca_tempo_real INTEGER NOT NULL DEFAULT 1,
                password_hash TEXT NOT NULL,
                face_fingerprint_id TEXT NOT NULL UNIQUE,
                face_embedding_json TEXT NOT NULL,
                face_hash_sha256 TEXT NOT NULL,
                face_quality_score REAL NOT NULL,
                face_image_data_url TEXT NOT NULL,
                face_image_path TEXT DEFAULT '',
                face_locked INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

        # Safe column migration if pulse_pe.db already existed from previous version
        existing_cols = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(users)").fetchall()
        }
        migrations = {
            "plano": "TEXT DEFAULT ''",
            "categoria": "TEXT DEFAULT ''",
            "membro_desde": "TEXT DEFAULT ''",
            "telefone": "TEXT DEFAULT ''",
            "documento_identificacao": "TEXT DEFAULT ''",
            "orgao_emissor": "TEXT DEFAULT ''",
            "acessibilidade": "TEXT DEFAULT ''",
            "alertas_portao": "INTEGER NOT NULL DEFAULT 1",
            "catraca_tempo_real": "INTEGER NOT NULL DEFAULT 1",
            "face_image_path": "TEXT DEFAULT ''",
            "updated_at": "TEXT DEFAULT ''",
        }
        for col, col_def in migrations.items():
            if col not in existing_cols:
                conn.execute(f"ALTER TABLE users ADD COLUMN {col} {col_def}")

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS dependents (
                id TEXT PRIMARY KEY,
                user_email TEXT NOT NULL,
                nome TEXT NOT NULL,
                parentesco TEXT DEFAULT '',
                documento TEXT DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS tickets (
                codigo TEXT PRIMARY KEY,
                match_id TEXT DEFAULT '',
                competicao TEXT DEFAULT '',
                jogo TEXT NOT NULL,
                estadio TEXT DEFAULT '',
                data_horario TEXT DEFAULT '',
                setor TEXT DEFAULT '',
                subsetor TEXT DEFAULT '',
                portao TEXT DEFAULT '',
                endereco_portao TEXT DEFAULT '',
                titular TEXT DEFAULT '',
                cpf TEXT DEFAULT '',
                user_email TEXT DEFAULT '',
                biometria_ok INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'pendente',
                motivo_reprovacao TEXT DEFAULT '',
                created_at TEXT NOT NULL,
                reviewed_at TEXT DEFAULT '',
                reviewed_by TEXT DEFAULT ''
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS biometric_logs (
                id TEXT PRIMARY KEY,
                user_email TEXT DEFAULT '',
                tipo TEXT NOT NULL,
                aprovado INTEGER NOT NULL,
                similaridade REAL DEFAULT 0,
                qualidade REAL DEFAULT 0,
                checks_json TEXT DEFAULT '{}',
                motivos_json TEXT DEFAULT '[]',
                created_at TEXT NOT NULL
            )
            """
        )

        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notifications (
                id TEXT PRIMARY KEY,
                user_email TEXT DEFAULT '',
                categoria TEXT NOT NULL,
                selo TEXT NOT NULL,
                titulo TEXT NOT NULL,
                mensagem TEXT NOT NULL,
                detalhe_rodape TEXT DEFAULT '',
                lida INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()

        # Backfill storage/faces/*.jpg for any user already in SQLite without a saved .jpg file
        rows = conn.execute(
            "SELECT id, face_fingerprint_id, face_image_data_url, face_image_path FROM users"
        ).fetchall()
        for r in rows:
            fp_id = r["face_fingerprint_id"]
            data_url = r["face_image_data_url"]
            expected_file = FACES_DIR / f"{fp_id}.jpg"
            if data_url and (not expected_file.exists() or not r["face_image_path"]):
                try:
                    rel_path = save_face_file(fp_id, data_url)
                    conn.execute(
                        "UPDATE users SET face_image_path = ? WHERE id = ?",
                        (rel_path, r["id"]),
                    )
                except Exception:
                    pass
        conn.commit()


def save_face_file(fingerprint_id: str, data_url: str) -> str:
    FACES_DIR.mkdir(parents=True, exist_ok=True)
    raw_b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
    img_bytes = base64.b64decode(raw_b64)
    file_path = FACES_DIR / f"{fingerprint_id}.jpg"
    file_path.write_bytes(img_bytes)
    return str(file_path.relative_to(BASE_DIR))


def hash_password(password: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()


def get_dependents_by_email(email: str) -> list[dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, nome, parentesco, documento, created_at FROM dependents WHERE LOWER(user_email) = LOWER(?) ORDER BY created_at ASC",
            (email.strip(),),
        ).fetchall()
        return [dict(r) for r in rows]


def get_user_by_email(email: str) -> Optional[dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE LOWER(email) = LOWER(?)",
            (email.strip(),),
        ).fetchone()
        if not row:
            return None
        user = dict(row)
        user["dependentes"] = get_dependents_by_email(user["email"])
        return user


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
    now = datetime.now(timezone.utc).isoformat()
    email_norm = email.strip().lower()
    pwd_hash = hash_password(password, email_norm)
    face_path = save_face_file(face_fingerprint_id, face_image_data_url)

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO users (
                id, nome, cpf, email, matricula, password_hash,
                face_fingerprint_id, face_embedding_json, face_hash_sha256,
                face_quality_score, face_image_data_url, face_image_path,
                face_locked, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
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
                face_path,
                now,
                now,
            ),
        )
        conn.commit()

    return get_user_by_email(email_norm)  # type: ignore[return-value]


def update_user_profile(
    email: str,
    updates: dict[str, Any],
    dependentes: Optional[list[dict[str, Any]]] = None,
) -> Optional[dict[str, Any]]:
    user = get_user_by_email(email)
    if not user:
        return None

    now = datetime.now(timezone.utc).isoformat()
    allowed = {
        "nome",
        "matricula",
        "plano",
        "categoria",
        "membro_desde",
        "telefone",
        "documento_identificacao",
        "orgao_emissor",
        "acessibilidade",
        "alertas_portao",
        "catraca_tempo_real",
    }

    set_clauses: list[str] = ["updated_at = ?"]
    values: list[Any] = [now]
    for key, val in updates.items():
        if key in allowed and val is not None:
            set_clauses.append(f"{key} = ?")
            values.append(int(val) if isinstance(val, bool) else str(val).strip())

    values.append(email.strip().lower())

    with get_connection() as conn:
        conn.execute(
            f"UPDATE users SET {', '.join(set_clauses)} WHERE LOWER(email) = LOWER(?)",
            tuple(values),
        )

        if dependentes is not None:
            conn.execute(
                "DELETE FROM dependents WHERE LOWER(user_email) = LOWER(?)",
                (email.strip().lower(),),
            )
            for dep in dependentes:
                conn.execute(
                    """
                    INSERT INTO dependents (id, user_email, nome, parentesco, documento, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        dep.get("id") or str(uuid.uuid4()),
                        email.strip().lower(),
                        str(dep.get("nome", "")).strip(),
                        str(dep.get("parentesco", "")).strip(),
                        str(dep.get("documento", "")).strip(),
                        now,
                    ),
                )
        conn.commit()

    return get_user_by_email(email)


def authenticate_user(email: str, password: str) -> Optional[dict[str, Any]]:
    user = get_user_by_email(email)
    if not user:
        return None
    expected = hash_password(password, user["email"].lower())
    if expected != user["password_hash"]:
        return None
    return user


def log_biometric_attempt(
    *,
    user_email: str,
    tipo: str,
    aprovado: bool,
    similaridade: float,
    qualidade: float,
    checks: dict[str, Any],
    motivos: list[str],
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO biometric_logs (
                id, user_email, tipo, aprovado, similaridade, qualidade,
                checks_json, motivos_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                str(uuid.uuid4()),
                user_email.strip().lower(),
                tipo,
                1 if aprovado else 0,
                round(similaridade, 1),
                round(qualidade, 1),
                json.dumps(checks, ensure_ascii=False),
                json.dumps(motivos, ensure_ascii=False),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()


def upsert_ticket(ticket: dict[str, Any]) -> dict[str, Any]:
    codigo = str(ticket["codigo"]).strip().upper()
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        existing = conn.execute(
            "SELECT * FROM tickets WHERE codigo = ?", (codigo,)
        ).fetchone()
        if existing:
            return dict(existing)

        conn.execute(
            """
            INSERT INTO tickets (
                codigo, match_id, competicao, jogo, estadio, data_horario,
                setor, subsetor, portao, endereco_portao, titular, cpf,
                user_email, biometria_ok, status, motivo_reprovacao,
                created_at, reviewed_at, reviewed_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                codigo,
                ticket.get("matchId", ""),
                ticket.get("competicao", ""),
                ticket.get("jogo", ""),
                ticket.get("estadio", ""),
                ticket.get("dataHorario", ""),
                ticket.get("setor", ""),
                ticket.get("subsetor", ""),
                ticket.get("portao", ""),
                ticket.get("enderecoPortao", ""),
                ticket.get("titular", ""),
                ticket.get("cpf", ""),
                ticket.get("userEmail", ""),
                1 if ticket.get("biometriaOk") else 0,
                ticket.get("status", "pendente"),
                ticket.get("motivoReprovacao", ""),
                now,
                ticket.get("reviewedAt", ""),
                ticket.get("reviewedBy", ""),
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM tickets WHERE codigo = ?", (codigo,)
        ).fetchone()
        return dict(row)  # type: ignore[arg-type]


def list_tickets(codigos: Optional[list[str]] = None) -> list[dict[str, Any]]:
    with get_connection() as conn:
        if codigos:
            clean = [c.strip().upper() for c in codigos if c.strip()]
            if not clean:
                return []
            placeholders = ",".join("?" for _ in clean)
            rows = conn.execute(
                f"SELECT * FROM tickets WHERE codigo IN ({placeholders}) ORDER BY created_at DESC",
                tuple(clean),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM tickets ORDER BY created_at DESC"
            ).fetchall()
        return [dict(r) for r in rows]


def review_ticket(
    *,
    codigo: str,
    decision: str,
    motivo_reprovacao: str,
    reviewed_by: str,
) -> Optional[dict[str, Any]]:
    code = codigo.strip().upper()
    now = "" if decision == "pendente" else datetime.now(timezone.utc).isoformat()
    reviewer = "" if decision == "pendente" else reviewed_by
    motivo = motivo_reprovacao.strip() if decision == "reprovado" else ""

    with get_connection() as conn:
        conn.execute(
            """
            UPDATE tickets
            SET status = ?, motivo_reprovacao = ?, reviewed_at = ?, reviewed_by = ?
            WHERE codigo = ?
            """,
            (decision, motivo, now, reviewer, code),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM tickets WHERE codigo = ?", (code,)
        ).fetchone()
        return dict(row) if row else None


def delete_ticket(codigo: str) -> bool:
    with get_connection() as conn:
        cur = conn.execute(
            "DELETE FROM tickets WHERE codigo = ?", (codigo.strip().upper(),)
        )
        conn.commit()
        return cur.rowcount > 0


def add_notification(
    *,
    user_email: str,
    categoria: str,
    selo: str,
    titulo: str,
    mensagem: str,
    detalhe_rodape: str = "",
) -> dict[str, Any]:
    notif_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO notifications (
                id, user_email, categoria, selo, titulo, mensagem,
                detalhe_rodape, lida, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
            """,
            (
                notif_id,
                user_email.strip().lower(),
                categoria,
                selo,
                titulo,
                mensagem,
                detalhe_rodape,
                now,
            ),
        )
        conn.commit()
        row = conn.execute(
            "SELECT * FROM notifications WHERE id = ?", (notif_id,)
        ).fetchone()
        return dict(row)  # type: ignore[arg-type]


def list_notifications(user_email: Optional[str] = None) -> list[dict[str, Any]]:
    with get_connection() as conn:
        if user_email:
            rows = conn.execute(
                "SELECT * FROM notifications WHERE LOWER(user_email) = LOWER(?) OR user_email = '' ORDER BY created_at DESC LIMIT 100",
                (user_email.strip(),),
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT * FROM notifications ORDER BY created_at DESC LIMIT 100"
            ).fetchall()
        return [dict(r) for r in rows]


def get_storage_summary() -> dict[str, Any]:
    with get_connection() as conn:
        users_count = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        tickets_count = conn.execute("SELECT COUNT(*) FROM tickets").fetchone()[0]
        logs_count = conn.execute("SELECT COUNT(*) FROM biometric_logs").fetchone()[0]
        notifs_count = conn.execute("SELECT COUNT(*) FROM notifications").fetchone()[0]
        return {
            "databasePath": str(DB_PATH),
            "facesDirectory": str(FACES_DIR),
            "totalUsers": users_count,
            "totalTickets": tickets_count,
            "totalBiometricLogs": logs_count,
            "totalNotifications": notifs_count,
        }
