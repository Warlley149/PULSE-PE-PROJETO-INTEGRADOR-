import uuid
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    authenticate_user,
    create_user_with_biometrics,
    get_user_by_cpf,
    get_user_by_email,
    init_db,
    list_all_embeddings,
)
from face_engine import cosine_similarity, validate_and_extract_face

app = FastAPI(
    title="PULSE-PE — Serviço de Reconhecimento Facial (Python)",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()


class AnalyzeRequest(BaseModel):
    imageDataUrl: str


class RegisterRequest(BaseModel):
    nome: str
    cpf: str
    email: str
    password: str
    matricula: str = ""
    imageDataUrl: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyRequest(BaseModel):
    email: str
    imageDataUrl: str


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "nome": user["nome"],
        "cpf": user["cpf"],
        "email": user["email"],
        "matricula": user["matricula"],
        "faceFingerprintId": user["face_fingerprint_id"],
        "faceHashSha256": user["face_hash_sha256"],
        "faceQualityScore": user["face_quality_score"],
        "faceImageDataUrl": user["face_image_data_url"],
        "faceLocked": bool(user["face_locked"]),
        "createdAt": user["created_at"],
    }


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": "pulse-pe-biometria-python"}


@app.post("/api/v1/biometria/analisar")
def analisar_biometria(payload: AnalyzeRequest) -> dict:
    try:
        res = validate_and_extract_face(payload.imageDataUrl)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Erro ao processar imagem: {exc}"
        ) from exc

    return {
        "valido": res.valid,
        "motivos": res.reasons,
        "checks": res.checks,
        "qualidade": res.quality_score,
        "largura": res.width,
        "altura": res.height,
    }


@app.post("/api/v1/auth/cadastrar", status_code=201)
def cadastrar_usuario(payload: RegisterRequest) -> dict:
    nome = payload.nome.strip()
    cpf_digits = "".join(ch for ch in payload.cpf if ch.isdigit())
    email = payload.email.strip().lower()

    if len(nome) < 3:
        raise HTTPException(status_code=400, detail="Informe seu nome completo.")
    if len(cpf_digits) != 11:
        raise HTTPException(
            status_code=400, detail="Informe um CPF válido com 11 dígitos."
        )
    if "@" not in email or len(payload.password) < 4:
        raise HTTPException(
            status_code=400,
            detail="Informe um e-mail válido e senha com no mínimo 4 caracteres.",
        )

    # Immutable one-time registration rule: block duplicate email or CPF
    if get_user_by_email(email):
        raise HTTPException(
            status_code=409,
            detail="Este e-mail já possui cadastro e biometria facial definitiva (não pode ser alterada).",
        )
    if get_user_by_cpf(payload.cpf):
        raise HTTPException(
            status_code=409,
            detail="Este CPF já possui cadastro e biometria facial definitiva (não pode ser alterada).",
        )

    # Run strict real Computer Vision facial validation
    try:
        face_res = validate_and_extract_face(payload.imageDataUrl)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Falha ao decodificar imagem facial: {exc}"
        ) from exc

    if not face_res.valid:
        raise HTTPException(
            status_code=422,
            detail={
                "mensagem": "Reconhecimento facial reprovado. Corrija os itens abaixo e tente novamente.",
                "motivos": face_res.reasons,
                "checks": face_res.checks,
                "qualidade": face_res.quality_score,
            },
        )

    # 1:N Uniqueness Check: each user has a single unique facial fingerprint
    existing_users = list_all_embeddings()
    for other in existing_users:
        sim = cosine_similarity(face_res.embedding, other["embedding"])
        if sim >= 0.92:
            raise HTTPException(
                status_code=409,
                detail={
                    "mensagem": "Esta impressão facial já pertence a outro usuário cadastrado. Cada usuário possui uma única biometria definitiva.",
                    "motivos": [
                        f"Rosto já vinculado ao cadastro #{other['face_fingerprint_id']} (similaridade {sim * 100:.1f}%)."
                    ],
                    "checks": face_res.checks,
                },
            )

    created = create_user_with_biometrics(
        user_id=str(uuid.uuid4()),
        nome=nome,
        cpf=payload.cpf.strip(),
        email=email,
        matricula=payload.matricula.strip(),
        password=payload.password,
        face_fingerprint_id=face_res.fingerprint_id,
        face_embedding=face_res.embedding,
        face_hash_sha256=face_res.sha256_hash,
        face_quality_score=face_res.quality_score,
        face_image_data_url=payload.imageDataUrl,
    )

    return {
        "cadastrado": True,
        "user": _public_user(created),
        "checks": face_res.checks,
    }


@app.post("/api/v1/auth/login")
def login_usuario(payload: LoginRequest) -> dict:
    user = authenticate_user(payload.email, payload.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="E-mail ou senha incorretos. Cadastre-se caso ainda não tenha conta.",
        )
    return {
        "authenticated": True,
        "user": _public_user(user),
    }


@app.post("/api/v1/biometria/verificar")
def verificar_biometria(payload: VerifyRequest) -> dict:
    user = get_user_by_email(payload.email)
    if not user:
        raise HTTPException(
            status_code=404,
            detail="Usuário não encontrado na base biométrica.",
        )

    try:
        live_res = validate_and_extract_face(payload.imageDataUrl)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Erro ao processar imagem: {exc}"
        ) from exc

    if not live_res.valid:
        return {
            "aprovado": False,
            "similaridade": 0.0,
            "motivos": live_res.reasons,
            "checks": live_res.checks,
            "qualidade": live_res.quality_score,
        }

    import json

    stored_embedding = json.loads(user["face_embedding_json"])
    sim = cosine_similarity(live_res.embedding, stored_embedding)
    sim_pct = round(sim * 100.0, 1)
    aprovado = sim >= 0.78

    return {
        "aprovado": aprovado,
        "similaridade": sim_pct,
        "faceFingerprintId": user["face_fingerprint_id"],
        "motivos": (
            []
            if aprovado
            else [
                f"Rosto não corresponde à impressão biométrica cadastrada ({sim_pct}% de similaridade)."
            ]
        ),
        "checks": live_res.checks,
        "qualidade": live_res.quality_score,
    }

