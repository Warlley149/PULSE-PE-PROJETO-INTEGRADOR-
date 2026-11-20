# PULSE-PE — Back-end de Reconhecimento Facial (Python)

Serviço em **FastAPI + OpenCV + NumPy + SQLite** responsável pela validação biométrica facial real, unicidade de impressão facial (1:N) e verificação ao vivo (1:1) da plataforma PULSE-PE.

## Validações realizadas no rosto
1. **Enquadramento único**: detecta exatamente 1 rosto frontal centralizado.
2. **Iluminação adequada**: reprova ambientes escuros, estouro de luz ou sombras laterais fortes.
3. **Nitidez**: reprova imagens tremidas ou desfocadas (variância Laplaciana).
4. **Olhos visíveis e sem óculos**: exige ambos os olhos detectados e reprova óculos escuros ou obstruções oculares.
5. **Rosto descoberto (sem máscara)**: analisa continuidade de pele na região inferior do rosto (nariz/boca).
6. **Cabeça livre (sem boné/chapéu)**: analisa a região da testa contra sombra de aba ou cobertura.
7. **Impressão facial única e imutável**: gera vetor biométrico normalizado (`BIO-XXXXXXXXXXXX`) + `SHA-256`, impede duplicidade de rosto entre usuários (1:N) e trava alterações posteriores (`face_locked = 1`).

## Como executar localmente
```bash
.venv\Scripts\activate
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```
