import json
import uuid
from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from database import (
    add_notification,
    authenticate_user,
    create_user_with_biometrics,
    delete_ticket,
    get_storage_summary,
    get_user_by_cpf,
    get_user_by_email,
    init_db,
    list_all_embeddings,
    list_notifications,
    list_tickets,
    log_biometric_attempt,
    review_ticket,
    update_user_profile,
    upsert_ticket,
)
from face_engine import cosine_similarity, validate_and_extract_face

app = FastAPI(
    title="PULSE-PE — Back-end Completo & Reconhecimento Facial (Python + Supabase/SQLite)",
    version="2.1.0",
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


class ProfileUpdateRequest(BaseModel):
    email: str
    nome: Optional[str] = None
    matricula: Optional[str] = None
    plano: Optional[str] = None
    categoria: Optional[str] = None
    membroDesde: Optional[str] = None
    telefone: Optional[str] = None
    documentoIdentificacao: Optional[str] = None
    orgaoEmissor: Optional[str] = None
    acessibilidade: Optional[str] = None
    alertasPortao: Optional[bool] = None
    catracaTempoReal: Optional[bool] = None
    dependentes: Optional[list[dict[str, Any]]] = None


class TicketCreateRequest(BaseModel):
    codigo: str
    matchId: str = ""
    competicao: str = ""
    jogo: str
    estadio: str = ""
    dataHorario: str = ""
    setor: str = ""
    subsetor: str = ""
    portao: str = ""
    enderecoPortao: str = ""
    titular: str = ""
    cpf: str = ""
    userEmail: str = ""
    biometriaOk: bool = False


class TicketReviewRequest(BaseModel):
    codigo: str
    decision: str
    motivoReprovacao: str = ""
    reviewedBy: str = "admin@pulsepe.gov.br"


class NotificationCreateRequest(BaseModel):
    userEmail: str = ""
    categoria: str
    selo: str
    titulo: str
    mensagem: str
    detalheRodape: str = ""


def _public_user(user: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "nome": user["nome"],
        "cpf": user["cpf"],
        "email": user["email"],
        "matricula": user.get("matricula", ""),
        "plano": user.get("plano", ""),
        "categoria": user.get("categoria", ""),
        "membroDesde": user.get("membro_desde", ""),
        "telefone": user.get("telefone", ""),
        "documentoIdentificacao": user.get("documento_identificacao", ""),
        "orgaoEmissor": user.get("orgao_emissor", ""),
        "acessibilidade": user.get("acessibilidade", ""),
        "alertasPortao": bool(user.get("alertas_portao", 1)),
        "catracaTempoReal": bool(user.get("catraca_tempo_real", 1)),
        "dependentes": user.get("dependentes", []),
        "faceFingerprintId": user["face_fingerprint_id"],
        "faceHashSha256": user["face_hash_sha256"],
        "faceQualityScore": user["face_quality_score"],
        "faceImageDataUrl": user["face_image_data_url"],
        "faceImagePath": user.get("face_image_path", ""),
        "faceLocked": bool(user["face_locked"]),
        "createdAt": user["created_at"],
    }


def _public_ticket(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "codigo": row["codigo"],
        "matchId": row["match_id"],
        "competicao": row["competicao"],
        "jogo": row["jogo"],
        "estadio": row["estadio"],
        "dataHorario": row["data_horario"],
        "setor": row["setor"],
        "subsetor": row["subsetor"],
        "portao": row["portao"],
        "enderecoPortao": row["endereco_portao"],
        "titular": row["titular"],
        "cpf": row["cpf"],
        "biometriaOk": bool(row["biometria_ok"]),
        "status": row["status"],
        "motivoReprovacao": row["motivo_reprovacao"] or undefined_to_none(),
        "createdAt": row["created_at"],
        "reviewedAt": row["reviewed_at"] or None,
        "reviewedBy": row["reviewed_by"] or None,
    }


def undefined_to_none() -> None:
    return None


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "service": "pulse-pe-biometria-python",
        "storage": get_storage_summary(),
    }


@app.post("/api/v1/biometria/analisar")
def analisar_biometria(payload: AnalyzeRequest) -> dict[str, Any]:
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
def cadastrar_usuario(payload: RegisterRequest) -> dict[str, Any]:
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

    try:
        face_res = validate_and_extract_face(payload.imageDataUrl)
    except Exception as exc:
        raise HTTPException(
            status_code=400, detail=f"Falha ao decodificar imagem facial: {exc}"
        ) from exc

    if not face_res.valid:
        log_biometric_attempt(
            user_email=email,
            tipo="cadastro",
            aprovado=False,
            similaridade=0.0,
            qualidade=face_res.quality_score,
            checks=face_res.checks,
            motivos=face_res.reasons,
        )
        raise HTTPException(
            status_code=422,
            detail={
                "mensagem": "Reconhecimento facial reprovado. Corrija os itens abaixo e tente novamente.",
                "motivos": face_res.reasons,
                "checks": face_res.checks,
                "qualidade": face_res.quality_score,
            },
        )

    existing_users = list_all_embeddings()
    for other in existing_users:
        sim = cosine_similarity(face_res.embedding, other["embedding"])
        if sim >= 0.82:
            msg = f"Esta face já existe no sistema! Cada pessoa só pode ter um único cadastro (similaridade {sim * 100:.1f}% com {other['face_fingerprint_id']})."
            log_biometric_attempt(
                user_email=email,
                tipo="cadastro",
                aprovado=False,
                similaridade=sim * 100.0,
                qualidade=face_res.quality_score,
                checks=face_res.checks,
                motivos=[msg],
            )
            raise HTTPException(
                status_code=409,
                detail={
                    "mensagem": "Esta face já existe no sistema! Cada pessoa só pode ter um único cadastro.",
                    "motivos": [msg],
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

    log_biometric_attempt(
        user_email=email,
        tipo="cadastro",
        aprovado=True,
        similaridade=100.0,
        qualidade=face_res.quality_score,
        checks=face_res.checks,
        motivos=[],
    )

    add_notification(
        user_email=email,
        categoria="acesso",
        selo="BIOMETRIA ÚNICA CADASTRADA",
        titulo=f"Cadastro biométrico de {nome} salvo no banco SQLite",
        mensagem=f"Impressão facial {face_res.fingerprint_id} validada com {face_res.quality_score}% de qualidade e travada contra alterações.",
        detalhe_rodape="Armazenado em pulse_pe.db",
    )

    return {
        "cadastrado": True,
        "user": _public_user(created),
        "checks": face_res.checks,
    }


@app.post("/api/v1/auth/login")
def login_usuario(payload: LoginRequest) -> dict[str, Any]:
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


@app.put("/api/v1/users/perfil")
def atualizar_perfil(payload: ProfileUpdateRequest) -> dict[str, Any]:
    updated = update_user_profile(
        payload.email,
        {
            "nome": payload.nome,
            "matricula": payload.matricula,
            "plano": payload.plano,
            "categoria": payload.categoria,
            "membro_desde": payload.membroDesde,
            "telefone": payload.telefone,
            "documento_identificacao": payload.documentoIdentificacao,
            "orgao_emissor": payload.orgaoEmissor,
            "acessibilidade": payload.acessibilidade,
            "alertas_portao": payload.alertasPortao,
            "catraca_tempo_real": payload.catracaTempoReal,
        },
        dependentes=payload.dependentes,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return {"user": _public_user(updated)}


@app.post("/api/v1/biometria/verificar")
def verificar_biometria(payload: VerifyRequest) -> dict[str, Any]:
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
        log_biometric_attempt(
            user_email=user["email"],
            tipo="verificacao",
            aprovado=False,
            similaridade=0.0,
            qualidade=live_res.quality_score,
            checks=live_res.checks,
            motivos=live_res.reasons,
        )
        return {
            "aprovado": False,
            "similaridade": 0.0,
            "motivos": live_res.reasons,
            "checks": live_res.checks,
            "qualidade": live_res.quality_score,
        }

    stored_embedding = json.loads(user["face_embedding_json"])
    sim = cosine_similarity(live_res.embedding, stored_embedding)
    sim_pct = round(sim * 100.0, 1)
    aprovado = sim >= 0.78
    motivos = (
        []
        if aprovado
        else [
            f"Rosto não corresponde à impressão biométrica cadastrada ({sim_pct}% de similaridade)."
        ]
    )

    log_biometric_attempt(
        user_email=user["email"],
        tipo="verificacao",
        aprovado=aprovado,
        similaridade=sim_pct,
        qualidade=live_res.quality_score,
        checks=live_res.checks,
        motivos=motivos,
    )

    return {
        "aprovado": aprovado,
        "similaridade": sim_pct,
        "faceFingerprintId": user["face_fingerprint_id"],
        "motivos": motivos,
        "checks": live_res.checks,
        "qualidade": live_res.quality_score,
    }


@app.get("/api/v1/tickets")
def listar_tickets(codigos: Optional[str] = None) -> dict[str, Any]:
    code_list = codigos.split(",") if codigos else None
    rows = list_tickets(code_list)
    return {"tickets": [_public_ticket(r) for r in rows]}


@app.post("/api/v1/tickets", status_code=201)
def criar_ticket(payload: TicketCreateRequest) -> dict[str, Any]:
    saved = upsert_ticket(payload.model_dump())
    return {"ticket": _public_ticket(saved)}


@app.post("/api/v1/tickets/review")
def revisar_ticket(payload: TicketReviewRequest) -> dict[str, Any]:
    if payload.decision not in ("aprovado", "reprovado", "pendente"):
        raise HTTPException(status_code=400, detail="Decisão inválida.")
    updated = review_ticket(
        codigo=payload.codigo,
        decision=payload.decision,
        motivo_reprovacao=payload.motivoReprovacao,
        reviewed_by=payload.reviewedBy,
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Bilhete não encontrado.")
    return {"ticket": _public_ticket(updated)}


@app.delete("/api/v1/tickets/{codigo}")
def remover_ticket(codigo: str) -> dict[str, Any]:
    return {"deleted": delete_ticket(codigo)}


@app.get("/api/v1/notifications")
def obter_notificacoes(email: Optional[str] = None) -> dict[str, Any]:
    return {"notifications": list_notifications(email)}


@app.post("/api/v1/notifications", status_code=201)
def criar_notificacao(payload: NotificationCreateRequest) -> dict[str, Any]:
    saved = add_notification(
        user_email=payload.userEmail,
        categoria=payload.categoria,
        selo=payload.selo,
        titulo=payload.titulo,
        mensagem=payload.mensagem,
        detalhe_rodape=payload.detalheRodape,
    )
    return {"notification": saved}


@app.get("/api/v1/admin/resumo")
def resumo_armazenamento() -> dict[str, Any]:
    return get_storage_summary()
