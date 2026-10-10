import json
import asyncio
import re
from typing import AsyncIterator, Optional, Dict, Any, List
import httpx

from app.core.config import settings

ASSISTANT_SYSTEM_PROMPT = """You are DeepVerify's Evidence-Grounded Forensic AI Assistant.
Your primary role is to interpret and synthesize structured forensic data for human investigators.

CRITICAL NON-NEGOTIABLE GROUNDING RULES:
1. Grounding Limitation: You DO NOT inspect or evaluate raw image pixels directly. You evaluate ONLY the structured JSON observations, model signals, policy configurations, and analysis results provided in context.
2. Safer Phrasing Rule: NEVER equate metadata or compression signatures with manipulation. Metadata fields (like software tags) and compression artifacts provide context, but neither independently establishes that an image was altered or synthetic.
3. Separation of Concerns:
   - Clearly distinguish Deterministic Media Observations (e.g. resolution, format, cryptographic hash) from Probabilistic Model Signals (e.g. spatial CNN or frequency FFT probabilities).
   - Deterministic observations are verified empirical properties.
   - Model signals are probabilistic outputs evaluated under specific model versions and score semantics.
4. Scientific Honesty & Semantics:
   - Model probabilities represent likelihoods under a specific model version and policy, NOT absolute proof or legal certainty.
   - Grad-CAM spatial activation maps identify neural network receptive-field feature focus, NOT tamper boundaries or forensic causality.
   - Frequency-domain signals reflect spectral distribution observations, not definitive proof of synthetic generation.
5. Explicit Citation: Always cite the exact model IDs, versions, and policy versions for every probabilistic claim.
6. Uncertainty & Caveats: Note any missing observations (e.g. absent EXIF metadata) or compression factors (e.g. JPEG DCT block compression) that could influence model sensitivity.
7. Refusal to Speculate: If asked about facts not contained in the provided evidence context, state clearly that the forensic ledger does not contain that information.
"""

def build_offline_synthesis(context: Dict[str, Any], question: Optional[str] = None) -> str:
    """
    Deterministically generates an authoritative, evidence-grounded scientific synthesis
    strictly from the structured context without external API dependencies.
    """
    ev = context.get("evidence", {})
    results = context.get("analysis_results", [])
    signals = context.get("signals", [])
    observations = context.get("observations", [])
    notes = context.get("investigator_notes")
    
    primary_res = results[0] if results else None
    spatial_sig = next((s for s in signals if "SPATIAL" in s.get("signal_type", "")), None)
    freq_sig = next((s for s in signals if "FREQUENCY" in s.get("signal_type", "")), None)
    
    dim_obs = next((o for o in observations if o.get("signal_type") == "IMAGE_DIMENSIONS"), None)
    format_obs = next((o for o in observations if o.get("signal_type") == "IMAGE_FORMAT"), None)
    
    lines = []
    lines.append("### Evidence Forensic Summary\n")
    lines.append(f"**Evidence ID:** `{ev.get('id', 'Unknown')}`  ")
    lines.append(f"**Cryptographic Hash (SHA-256):** `{ev.get('file_hash', 'Unknown')}`  ")
    lines.append(f"**MIME Type:** `{ev.get('mime_type', 'Unknown')}`\n")
    
    lines.append("#### 1. Deterministic Media Observations")
    if dim_obs or format_obs:
        if dim_obs:
            lines.append(f"- **Dimensions:** `{dim_obs.get('value')}` ({dim_obs.get('representation', '')}) [Provenance: {dim_obs.get('provenance', 'Backend')}]")
        if format_obs:
            lines.append(f"- **Format:** `{format_obs.get('value')}` ({format_obs.get('representation', '')}) [Provenance: {format_obs.get('provenance', 'Backend')}]")
    else:
        lines.append("- *No deterministic image geometry observations recorded in ledger.*")
    lines.append("- **Metadata (EXIF):** Not authoritatively present in pipeline observations.\n")
    
    lines.append("#### 2. Probabilistic Model Signals & Policy Classification")
    if primary_res:
        lines.append(f"- **Policy Verdict:** **{primary_res.get('verdict', 'UNKNOWN').replace('_', ' ')}**")
        lines.append(f"- **Ensemble Authenticity Score:** `{(primary_res.get('ensemble_score', 0) * 100):.1f}%` (Policy: `{primary_res.get('policy_version', 'Unknown')}`)")
    else:
        lines.append("- *Pipeline analysis is pending or no result recorded.*")
        
    if spatial_sig:
        s_val = float(spatial_sig.get('value', 0)) * 100
        lines.append(f"- **Spatial Domain Signal:** `{s_val:.1f}% Real` | Model: `{spatial_sig.get('model_id')}` v`{spatial_sig.get('model_version')}` (Semantics: `{spatial_sig.get('confidence_semantics')}`)")
    if freq_sig:
        f_val = float(freq_sig.get('value', 0)) * 100
        lines.append(f"- **Frequency Domain Signal:** `{f_val:.1f}% Real` | Model: `{freq_sig.get('model_id')}` v`{freq_sig.get('model_version')}` (Semantics: `{freq_sig.get('confidence_semantics')}`)")
    lines.append("")

    lines.append("#### 3. Scientific Grounding & Interpretive Boundaries")
    policy_ver = primary_res.get('policy_version', 'Unknown') if primary_res else 'the selected policy'
    lines.append(f"> **Important:** The probabilistic signals above represent numerical model activations under {policy_ver}. They do not independently prove manipulation or provenance.")
    lines.append("- **Grad-CAM Topography:** Spatial activations highlight regions of neural network receptive-field focus (feature sensitivity). High activation signifies feature relevance to the spatial classifier, not causal tamper boundaries.")
    lines.append("- **Frequency FFT Analysis:** Frequency features evaluate spectral distributions for high-frequency synthetic artifacts. Discrepancies between spatial and frequency signals often indicate container compression or resampling rather than malicious editing.")
    lines.append("")

    if notes:
        lines.append("#### 4. Investigator Context")
        lines.append(f"Recorded human investigator notes: *\"{notes}\"*")
        lines.append("")

    if question:
        q_lower = question.lower()
        lines.append(f"#### 5. Analysis for Investigator Query: \"{question}\"")
        if "diverge" in q_lower or "difference" in q_lower or "conflict" in q_lower:
            if spatial_sig and freq_sig:
                s_val = float(spatial_sig.get('value', 0))
                f_val = float(freq_sig.get('value', 0))
                diff = abs(s_val - f_val) * 100
                lines.append(f"Spatial signal (`{s_val*100:.1f}%`) and frequency signal (`{f_val*100:.1f}%`) exhibit a `{diff:.1f}%` spread. In synthetic forensics, divergent outputs typically occur when spatial textures lack characteristic generative artifacts (e.g. blending or smoothing) while the frequency spectrum captures residual artifacts from upsampling grids, or conversely when severe JPEG compression degrades spectral harmonics without disrupting spatial feature coherence.")
            else:
                lines.append("Model signals are insufficient in context to evaluate signal divergence.")
        elif "photoshop" in q_lower or "manipulat" in q_lower or "fake" in q_lower or "ai" in q_lower:
            lines.append("Per DeepVerify Grounding Rules, neither container metadata nor intermediate probabilistic scores prove intentional alteration. While the ensemble score reflects the policy's weighted evaluation of synthetic markers, independent confirmation (e.g., source device verification or pristine RAW capture) is required for conclusive attribution.")
        elif "dimension" in q_lower or "resolution" in q_lower or "size" in q_lower:
            if dim_obs:
                lines.append(f"Verified image dimensions are `{dim_obs.get('value')}` ({dim_obs.get('representation')}). Note that input tensors are resized and normalized by model adapters during preprocessing.")
            else:
                lines.append("Dimension observations are not recorded for this evidence item.")
        elif "hash" in q_lower or "integrity" in q_lower:
            lines.append(f"Evidence integrity is pinned by cryptographic SHA-256 digest: `{ev.get('file_hash')}`. Any byte-level modification would result in an entirely distinct hash.")
        else:
            if primary_res:
                lines.append(f"Based strictly on the recorded evidence ledger, the primary findings are: Verdict **{primary_res.get('verdict', 'N/A')}** with an ensemble authenticity score of **{(primary_res.get('ensemble_score', 0) * 100):.1f}%** under policy **{primary_res.get('policy_version', 'N/A')}**.")
            else:
                lines.append("Analysis results are currently pending or not yet computed for this evidence item.")
        lines.append("")

    return "\n".join(lines)

async def _stream_openai(context: Dict[str, Any], question: Optional[str]) -> AsyncIterator[str]:
    prompt = f"Evidence Context:\n{json.dumps(context, indent=2)}\n\nInvestigator Query: {question or 'Provide an evidence-grounded scientific synthesis of the evidence item.'}"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": ASSISTANT_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        "stream": True,
        "temperature": 0.2
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", "https://api.openai.com/v1/chat/completions", headers=headers, json=payload) as response:
            if response.status_code != 200:
                raise RuntimeError(f"OpenAI API returned HTTP {response.status_code}")
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break
                    try:
                        parsed = json.loads(data_str)
                        delta = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                        if delta:
                            yield delta
                    except Exception:
                        continue

async def _stream_anthropic(context: Dict[str, Any], question: Optional[str]) -> AsyncIterator[str]:
    prompt = f"Evidence Context:\n{json.dumps(context, indent=2)}\n\nInvestigator Query: {question or 'Provide an evidence-grounded scientific synthesis of the evidence item.'}"
    headers = {
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json"
    }
    payload = {
        "model": settings.ANTHROPIC_MODEL,
        "system": ASSISTANT_SYSTEM_PROMPT,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "max_tokens": 1500,
        "stream": True,
        "temperature": 0.2
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        async with client.stream("POST", "https://api.anthropic.com/v1/messages", headers=headers, json=payload) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Anthropic API returned HTTP {response.status_code}")
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    try:
                        parsed = json.loads(data_str)
                        if parsed.get("type") == "content_block_delta":
                            delta = parsed.get("delta", {}).get("text", "")
                            if delta:
                                yield delta
                    except Exception:
                        continue

ALLOWED_GEMINI_MODELS = {
    "gemini-2.5-flash",
    "gemini-3.8-flash",
    "gemini-2.5-pro",
    "gemini-3.5-flash"
}

def sanitize_gemini_model(model: Optional[str]) -> str:
    default_model = settings.GEMINI_MODEL or "gemini-2.5-flash"
    if not model:
        return default_model
    cleaned = model.strip()
    if cleaned in ALLOWED_GEMINI_MODELS:
        return cleaned
    if re.match(r"^gemini-[a-zA-Z0-9_\-\.]+$", cleaned) and len(cleaned) <= 64:
        return cleaned
    return default_model

def sanitize_api_key(api_key: Optional[str]) -> Optional[str]:
    if not api_key:
        return None
    cleaned = api_key.strip()
    if not cleaned:
        return None
    if not re.match(r"^[A-Za-z0-9_\-\.]+$", cleaned):
        raise ValueError("Invalid API key format: contains illegal characters.")
    if len(cleaned) < 10 or len(cleaned) > 128:
        raise ValueError("Invalid API key length.")
    return cleaned

async def _stream_google(
    context: Dict[str, Any], 
    question: Optional[str],
    api_key_override: Optional[str] = None,
    model_override: Optional[str] = None
) -> AsyncIterator[str]:
    raw_key = api_key_override or settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY
    if not raw_key:
        raise ValueError("GOOGLE_API_KEY is not configured.")
        
    api_key = sanitize_api_key(raw_key)
    model = sanitize_gemini_model(model_override)

    prompt = f"Evidence Context:\n{json.dumps(context, indent=2)}\n\nInvestigator Query: {question or 'Provide an evidence-grounded scientific synthesis of the evidence item.'}"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"
    
    headers = {
        "x-goog-api-key": api_key,
        "Content-Type": "application/json"
    }
    
    payload = {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": prompt}]
            }
        ],
        "systemInstruction": {
            "parts": [{"text": ASSISTANT_SYSTEM_PROMPT}]
        },
        "generationConfig": {
            "temperature": 0.2
        }
    }

    async with httpx.AsyncClient(timeout=40.0) as client:
        async with client.stream("POST", url, headers=headers, json=payload) as response:
            if response.status_code != 200:
                raise RuntimeError(f"Google Gemini API returned HTTP {response.status_code}")
            async for line in response.aiter_lines():
                if line.startswith("data: "):
                    data_str = line[6:].strip()
                    if not data_str or data_str == "[DONE]":
                        continue
                    try:
                        parsed = json.loads(data_str)
                        candidates = parsed.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for part in parts:
                                text = part.get("text", "")
                                if text:
                                    yield text
                    except Exception:
                        continue

async def validate_google_api_key(api_key: str, model: Optional[str] = None) -> tuple[bool, str, str]:
    """
    Validates a Google Gemini API key by making a lightweight test generation call.
    Passes credentials via the secure 'x-goog-api-key' header.
    """
    try:
        cleaned_key = sanitize_api_key(api_key)
        if not cleaned_key:
            return False, "unknown", "API key cannot be empty or whitespace."
    except ValueError as ve:
        return False, "unknown", str(ve)

    selected_model = sanitize_gemini_model(model)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{selected_model}:generateContent"
    headers = {
        "x-goog-api-key": cleaned_key,
        "Content-Type": "application/json"
    }
    payload = {
        "contents": [{"parts": [{"text": "ping"}]}],
        "generationConfig": {"maxOutputTokens": 1}
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.post(url, headers=headers, json=payload)
            if res.status_code == 200:
                return True, selected_model, "Google API key verified successfully with active quota."
            elif res.status_code in (400, 401):
                return False, selected_model, "Google API rejected key: Key format is invalid or unauthorized."
            elif res.status_code == 403:
                return False, selected_model, "Google API rejected key: Forbidden (insufficient permissions or exhausted quota)."
            elif res.status_code == 404:
                return False, selected_model, f"Google API error: Model '{selected_model}' was not found."
            else:
                return False, selected_model, f"Google API returned HTTP status {res.status_code}."
    except httpx.TimeoutException:
        return False, selected_model, "Connection timed out while verifying key with Google API."
    except Exception as e:
        return False, selected_model, f"Connection error verifying key: {type(e).__name__}"

async def _stream_offline(context: Dict[str, Any], question: Optional[str]) -> AsyncIterator[str]:
    text = build_offline_synthesis(context, question)
    # Stream in natural chunk fragments with small yield intervals for clean UX
    words = text.split(" ")
    batch_size = 3
    for i in range(0, len(words), batch_size):
        chunk = " ".join(words[i:i + batch_size])
        if i + batch_size < len(words):
            chunk += " "
        yield chunk
        await asyncio.sleep(0.015)

async def stream_assistant_response(
    context: Dict[str, Any], 
    question: Optional[str] = None,
    google_api_key: Optional[str] = None,
    gemini_model: Optional[str] = None
) -> AsyncIterator[str]:
    """
    Directs the stream to the appropriate provider (Google Gemini, OpenAI, Anthropic, or Offline Engine).
    Accepts user-configured client key overrides so keys can be changed from Settings without modifying code.
    Defaults reliably to the offline scientific engine if no external API key is active.
    """
    provider = settings.ASSISTANT_PROVIDER.lower()
    active_google_key = google_api_key or settings.GOOGLE_API_KEY or settings.GEMINI_API_KEY
    
    # 1. Google Gemini (Preferred when configured or provided via Settings/Request)
    if (provider in ("google", "gemini") or provider == "auto" or google_api_key) and active_google_key:
        try:
            tokens_streamed = 0
            async for chunk in _stream_google(context, question, api_key_override=active_google_key, model_override=gemini_model):
                tokens_streamed += 1
                yield chunk
            return
        except Exception as e:
            safe_err = f"Google Gemini unavailable: {type(e).__name__}"
            yield f"\n\n*[Notice: {safe_err}. Falling back to DeepVerify offline scientific engine.]*\n\n"
            async for chunk in _stream_offline(context, question):
                yield chunk
            return

    # 2. OpenAI
    if (provider == "openai" or (provider == "auto" and settings.OPENAI_API_KEY)) and settings.OPENAI_API_KEY:
        try:
            tokens_streamed = 0
            async for chunk in _stream_openai(context, question):
                tokens_streamed += 1
                yield chunk
            return
        except Exception as e:
            safe_err = f"OpenAI unavailable: {type(e).__name__}"
            yield f"\n\n*[Notice: {safe_err}. Falling back to DeepVerify offline scientific engine.]*\n\n"
            async for chunk in _stream_offline(context, question):
                yield chunk
            return

    # 3. Anthropic
    if (provider == "anthropic" or (provider == "auto" and settings.ANTHROPIC_API_KEY)) and settings.ANTHROPIC_API_KEY:
        try:
            tokens_streamed = 0
            async for chunk in _stream_anthropic(context, question):
                tokens_streamed += 1
                yield chunk
            return
        except Exception as e:
            safe_err = f"Anthropic unavailable: {type(e).__name__}"
            yield f"\n\n*[Notice: {safe_err}. Falling back to DeepVerify offline scientific engine.]*\n\n"
            async for chunk in _stream_offline(context, question):
                yield chunk
            return

    # 4. Default: Authoritative offline evidence grounding
    async for chunk in _stream_offline(context, question):
        yield chunk
