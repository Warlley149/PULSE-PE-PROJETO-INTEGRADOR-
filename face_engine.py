import base64
import hashlib
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

FACE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
)
EYE_CASCADE = cv2.CascadeClassifier(
    cv2.data.haarcascades + "haarcascade_eye.xml"
)


@dataclass
class FaceValidationResult:
    valid: bool
    reasons: list[str]
    checks: dict[str, dict[str, Any]]
    quality_score: float
    embedding: list[float]
    fingerprint_id: str
    sha256_hash: str
    width: int
    height: int


def decode_base64_image(data_url: str) -> tuple[np.ndarray, bytes]:
    raw_b64 = data_url.split(",", 1)[1] if "," in data_url else data_url
    img_bytes = base64.b64decode(raw_b64)
    arr = np.frombuffer(img_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Imagem inválida ou corrompida.")
    return img, img_bytes


def _skin_mask_ycrcb(bgr_roi: np.ndarray) -> np.ndarray:
    ycrcb = cv2.cvtColor(bgr_roi, cv2.COLOR_BGR2YCrCb)
    lower = np.array([45, 131, 75], dtype=np.uint8)
    upper = np.array([255, 178, 130], dtype=np.uint8)
    return cv2.inRange(ycrcb, lower, upper)


def _compute_face_embedding(gray_face: np.ndarray) -> list[float]:
    """
    Computes a compact, illumination-normalized biometric descriptor vector
    combining CLAHE-normalized spatial gradients (HOG-like) and frequency (DCT) features.
    """
    resized = cv2.resize(gray_face, (128, 128), interpolation=cv2.INTER_AREA)
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    norm = clahe.apply(resized).astype(np.float32) / 255.0

    # 1. Multi-cell gradient orientation histograms (4x4 grid, 8 orientation bins = 128 dims)
    gx = cv2.Sobel(norm, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(norm, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

    hog_features: list[float] = []
    cell = 32
    for r in range(0, 128, cell):
        for c in range(0, 128, cell):
            m_cell = mag[r : r + cell, c : c + cell]
            a_cell = ang[r : r + cell, c : c + cell]
            hist, _ = np.histogram(
                a_cell, bins=8, range=(0.0, 360.0), weights=m_cell
            )
            hist_norm = hist / (np.linalg.norm(hist) + 1e-6)
            hog_features.extend(hist_norm.tolist())

    # 2. Low-frequency 2D DCT facial structure coefficients (8x8 = 64 dims)
    dct = cv2.dct(norm)
    dct_low = dct[:8, :8].flatten()
    dct_low = dct_low / (np.linalg.norm(dct_low) + 1e-6)

    vec = np.concatenate([np.array(hog_features, dtype=np.float32), dct_low])
    vec = vec / (np.linalg.norm(vec) + 1e-6)
    return [round(float(x), 6) for x in vec]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    a = np.array(vec_a, dtype=np.float32)
    b = np.array(vec_b, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


def validate_and_extract_face(data_url: str) -> FaceValidationResult:
    img, img_bytes = decode_base64_image(data_url)
    h, w = img.shape[:2]
    sha256_hash = hashlib.sha256(img_bytes).hexdigest()

    reasons: list[str] = []
    checks: dict[str, dict[str, Any]] = {
        "enquadramento": {"ok": False, "detalhe": "Aguardando detecção facial"},
        "iluminacao": {"ok": False, "detalhe": "Aguardando análise de luz"},
        "nitidez": {"ok": False, "detalhe": "Aguardando análise de foco"},
        "olhos_sem_oculos": {"ok": False, "detalhe": "Verificando olhos"},
        "rosto_sem_mascara": {"ok": False, "detalhe": "Verificando rosto livre"},
        "testa_sem_bone": {"ok": False, "detalhe": "Verificando cabeça livre"},
    }

    if w < 240 or h < 240:
        reasons.append(
            "Resolução da câmera muito baixa. Use uma câmera com boa nitidez."
        )
        return FaceValidationResult(
            valid=False,
            reasons=reasons,
            checks=checks,
            quality_score=0.0,
            embedding=[],
            fingerprint_id="",
            sha256_hash=sha256_hash,
            width=w,
            height=h,
        )

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # 1. Frontal Face Detection
    faces = FACE_CASCADE.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(int(min(w, h) * 0.18), int(min(w, h) * 0.18)),
    )

    if len(faces) == 0:
        reasons.append(
            "Nenhum rosto frontal detectado. Centralize seu rosto, olhe para a câmera e remova boné, óculos ou máscara."
        )
        checks["enquadramento"] = {
            "ok": False,
            "detalhe": "Nenhum rosto frontal localizado",
        }
        return FaceValidationResult(
            valid=False,
            reasons=reasons,
            checks=checks,
            quality_score=0.0,
            embedding=[],
            fingerprint_id="",
            sha256_hash=sha256_hash,
            width=w,
            height=h,
        )

    if len(faces) > 1:
        reasons.append(
            "Mais de um rosto detectado na câmera. Apenas o titular deve aparecer no enquadramento."
        )
        checks["enquadramento"] = {
            "ok": False,
            "detalhe": f"{len(faces)} rostos detectados",
        }
        return FaceValidationResult(
            valid=False,
            reasons=reasons,
            checks=checks,
            quality_score=0.0,
            embedding=[],
            fingerprint_id="",
            sha256_hash=sha256_hash,
            width=w,
            height=h,
        )

    x, y, fw, fh = [int(v) for v in faces[0]]
    face_area_ratio = (fw * fh) / float(w * h)
    margin_ok = x > 6 and y > 6 and (x + fw) < (w - 6) and (y + fh) < (h - 6)

    if face_area_ratio < 0.045:
        reasons.append(
            "Rosto muito distante da câmera. Aproxime-se para preencher a moldura."
        )
        checks["enquadramento"] = {
            "ok": False,
            "detalhe": "Rosto muito distante",
        }
    elif not margin_ok:
        reasons.append(
            "Parte do rosto está cortada na borda. Centralize o rosto inteiro na tela."
        )
        checks["enquadramento"] = {
            "ok": False,
            "detalhe": "Rosto cortado nas bordas",
        }
    else:
        checks["enquadramento"] = {
            "ok": True,
            "detalhe": "Rosto único e centralizado",
        }

    face_bgr = img[y : y + fh, x : x + fw]
    face_gray = gray[y : y + fh, x : x + fw]

    # 2. Illumination & Uniformity Check
    mean_lum = float(np.mean(face_gray))
    left_lum = float(np.mean(face_gray[:, : fw // 2]))
    right_lum = float(np.mean(face_gray[:, fw // 2 :]))
    lum_diff = abs(left_lum - right_lum)

    if mean_lum < 72.0:
        reasons.append(
            "Ambiente muito escuro. Vá para um local bem iluminado para realizar o reconhecimento facial."
        )
        checks["iluminacao"] = {
            "ok": False,
            "detalhe": f"Luminosidade baixa ({mean_lum:.0f}/255)",
        }
    elif mean_lum > 235.0:
        reasons.append(
            "Excesso de brilho/estouro de luz no rosto. Evite luz forte direta sobre a lente."
        )
        checks["iluminacao"] = {
            "ok": False,
            "detalhe": f"Luz estourada ({mean_lum:.0f}/255)",
        }
    elif lum_diff > 52.0:
        reasons.append(
            "Sombra forte em um dos lados do rosto. Posicione-se de frente para a iluminação."
        )
        checks["iluminacao"] = {
            "ok": False,
            "detalhe": "Iluminação desigual (sombra lateral)",
        }
    else:
        checks["iluminacao"] = {
            "ok": True,
            "detalhe": f"Iluminação adequada ({mean_lum:.0f}/255)",
        }

    # 3. Sharpness / Focus Check
    laplacian_var = float(cv2.Laplacian(face_gray, cv2.CV_64F).var())
    if laplacian_var < 30.0:
        reasons.append(
            "Imagem tremida ou fora de foco. Segure o dispositivo firme e olhe para a câmera."
        )
        checks["nitidez"] = {
            "ok": False,
            "detalhe": f"Foco insuficiente ({laplacian_var:.0f})",
        }
    else:
        checks["nitidez"] = {
            "ok": True,
            "detalhe": f"Nitidez aprovada ({laplacian_var:.0f})",
        }

    # 4. Eyes Visible & No Sunglasses / Dark Glasses
    upper_face_gray = face_gray[int(fh * 0.12) : int(fh * 0.58), :]
    eyes = EYE_CASCADE.detectMultiScale(
        upper_face_gray,
        scaleFactor=1.08,
        minNeighbors=4,
        minSize=(int(fw * 0.10), int(fh * 0.08)),
    )

    # Filter distinct left & right eye detections
    left_eyes = [e for e in eyes if (e[0] + e[2] / 2) < fw * 0.52]
    right_eyes = [e for e in eyes if (e[0] + e[2] / 2) > fw * 0.48]

    eye_band = face_gray[int(fh * 0.24) : int(fh * 0.46), int(fw * 0.14) : int(fw * 0.86)]
    cheek_band = face_gray[int(fh * 0.50) : int(fh * 0.70), int(fw * 0.18) : int(fw * 0.82)]
    eye_lum = float(np.mean(eye_band)) if eye_band.size else mean_lum
    cheek_lum = float(np.mean(cheek_band)) if cheek_band.size else mean_lum
    dark_eye_ratio = float(np.mean(eye_band < 55)) if eye_band.size else 0.0

    # Check high-contrast glass frame/bridge edges between eyes
    bridge_band = face_gray[int(fh * 0.28) : int(fh * 0.44), int(fw * 0.38) : int(fw * 0.62)]
    bridge_edges = cv2.Canny(bridge_band, 80, 180) if bridge_band.size else np.zeros((1, 1))
    bridge_edge_density = float(np.mean(bridge_edges > 0))

    if dark_eye_ratio > 0.34 or (cheek_lum > 60 and eye_lum < cheek_lum * 0.62):
        reasons.append(
            "Óculos escuros ou obstrução na região dos olhos detectada. Remova qualquer tipo de óculos."
        )
        checks["olhos_sem_oculos"] = {
            "ok": False,
            "detalhe": "Obstrução/óculos escuros nos olhos",
        }
    elif len(left_eyes) == 0 or len(right_eyes) == 0:
        reasons.append(
            "Não foi possível identificar ambos os olhos claramente. Remova óculos, abra bem os olhos e olhe para a lente."
        )
        checks["olhos_sem_oculos"] = {
            "ok": False,
            "detalhe": "Ambos os olhos devem estar visíveis",
        }
    elif bridge_edge_density > 0.24:
        reasons.append(
            "Possível armação de óculos detectada sobre o nariz/olhos. Remova os óculos para validar sua biometria."
        )
        checks["olhos_sem_oculos"] = {
            "ok": False,
            "detalhe": "Possível armação de óculos",
        }
    else:
        checks["olhos_sem_oculos"] = {
            "ok": True,
            "detalhe": "Olhos visíveis e sem óculos",
        }

    # 5. No Mask / Lower Face Obstruction Check (YCrCb Skin Continuity)
    cheek_bgr = face_bgr[int(fh * 0.42) : int(fh * 0.62), int(fw * 0.16) : int(fw * 0.84)]
    lower_bgr = face_bgr[int(fh * 0.62) : int(fh * 0.92), int(fw * 0.20) : int(fw * 0.80)]
    cheek_skin_ratio = float(np.mean(_skin_mask_ycrcb(cheek_bgr) > 0)) if cheek_bgr.size else 0.0
    lower_skin_ratio = float(np.mean(_skin_mask_ycrcb(lower_bgr) > 0)) if lower_bgr.size else 0.0

    if cheek_skin_ratio > 0.25 and (lower_skin_ratio < 0.18 or lower_skin_ratio < cheek_skin_ratio * 0.35):
        reasons.append(
            "Obstrução detectada na região do nariz ou boca (máscara ou objeto). Mantenha o rosto totalmente descoberto."
        )
        checks["rosto_sem_mascara"] = {
            "ok": False,
            "detalhe": "Nariz/boca obstruídos",
        }
    else:
        checks["rosto_sem_mascara"] = {
            "ok": True,
            "detalhe": "Rosto descoberto e visível",
        }

    # 6. No Cap / Hat / Forehead Visor Obstruction Check
    forehead_gray = face_gray[0 : int(fh * 0.20), int(fw * 0.18) : int(fw * 0.82)]
    forehead_bgr = face_bgr[0 : int(fh * 0.20), int(fw * 0.18) : int(fw * 0.82)]
    forehead_lum = float(np.mean(forehead_gray)) if forehead_gray.size else mean_lum
    forehead_skin = float(np.mean(_skin_mask_ycrcb(forehead_bgr) > 0)) if forehead_bgr.size else 0.0

    # Check strong horizontal cap brim edge across the upper forehead
    sobel_y = np.abs(cv2.Sobel(forehead_gray, cv2.CV_64F, 0, 1, ksize=3)) if forehead_gray.size else np.zeros((1, 1))
    strong_horizontal_brim = float(np.mean(sobel_y > 95))

    if (cheek_lum > 65 and forehead_lum < cheek_lum * 0.56) or (
        cheek_skin_ratio > 0.30 and forehead_skin < 0.12 and strong_horizontal_brim > 0.18
    ):
        reasons.append(
            "Possível boné, chapéu ou sombra de aba na testa detectada. Remova acessórios da cabeça."
        )
        checks["testa_sem_bone"] = {
            "ok": False,
            "detalhe": "Obstrução/boné na região da testa",
        }
    else:
        checks["testa_sem_bone"] = {
            "ok": True,
            "detalhe": "Testa livre (sem boné/chapéu)",
        }

    # Compute real quality score and biometric embedding
    exposure_score = 1.0 - min(1.0, abs(mean_lum - 140.0) / 140.0)
    sharp_score = min(1.0, laplacian_var / 140.0)
    passed_ratio = sum(1 for c in checks.values() if c["ok"]) / len(checks)
    quality_score = round(
        min(99.9, max(10.0, (exposure_score * 0.35 + sharp_score * 0.25 + passed_ratio * 0.40) * 100.0)),
        1,
    )

    is_valid = len(reasons) == 0
    embedding = _compute_face_embedding(face_gray) if is_valid else []
    fingerprint_id = ""
    if is_valid:
        emb_digest = hashlib.sha256(
            ",".join(f"{v:.4f}" for v in embedding).encode("utf-8")
        ).hexdigest()[:12].upper()
        fingerprint_id = f"BIO-{emb_digest}"

    return FaceValidationResult(
        valid=is_valid,
        reasons=reasons,
        checks=checks,
        quality_score=quality_score,
        embedding=embedding,
        fingerprint_id=fingerprint_id,
        sha256_hash=sha256_hash,
        width=w,
        height=h,
    )

