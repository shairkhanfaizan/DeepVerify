import io
import os
import uuid
import html
import json
import hashlib
from datetime import datetime, timezone
from typing import Optional, List, Any
from PIL import Image as PILImage

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    KeepTogether, HRFlowable, Image as RLImage
)
from reportlab.pdfgen import canvas

from app.core.storage import get_storage_provider


class NumberedCanvas(canvas.Canvas):
    """
    Two-pass canvas that accurately calculates total page numbers
    and renders uniform professional headers and footers with safe clearances.
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_header_footer(num_pages)
            super().showPage()
        super().save()

    def draw_header_footer(self, page_count: int):
        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))

        # Running header on page 2+ (clearance above y=737 content boundary)
        if self._pageNumber > 1:
            self.drawString(40, 755, "DEEPVERIFY FORENSIC CASE REPORT")
            self.drawRightString(572, 755, "CONFIDENTIAL EVIDENCE DOSSIER")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.5)
            self.line(40, 747, 572, 747)

        # Running footer on all pages (clearance below y=55 content boundary)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.5)
        self.line(40, 42, 42, 42)
        self.line(40, 42, 572, 42)

        self.drawString(40, 30, "DeepVerify V2 Forensic Engine — Direct Ledger Verification")
        self.drawRightString(572, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def safe_text(val: Any) -> str:
    """Escapes user and database strings to prevent ReportLab XML parser crashes."""
    if val is None:
        return ""
    return html.escape(str(val))


def safe_multiline(val: Any) -> str:
    """Escapes text and converts linebreaks to valid ReportLab XML break tags."""
    if val is None:
        return ""
    escaped = html.escape(str(val))
    return escaped.replace("\n", "<br/>")


def format_signal_display(signal_type: str, raw_val: Any, semantics: Optional[str]) -> str:
    """Accurately formats probability signals without making definitive claims."""
    try:
        val_float = float(raw_val) * 100
        return f"{val_float:.1f}"
    except Exception:
        return safe_text(raw_val)


def compute_canonical_ledger_digest(investigation: Any, target_items: List[Any]) -> str:
    """
    Computes a deterministic, reproducible SHA-256 digest over the canonical
    evidentiary records in PostgreSQL. Any alteration to evidence hashes,
    observations, model signals, policies, or notes changes this digest.
    """
    canonical_data = {
        "investigation_id": str(investigation.id),
        "title": str(investigation.title or ""),
        "status": str(getattr(investigation, "status", "OPEN")),
        "notes": str(getattr(investigation, "notes", "") or ""),
        "evidence_items": []
    }

    sorted_items = sorted(target_items, key=lambda e: str(e.id))
    for ev in sorted_items:
        obs_list = getattr(ev, "observations", []) or []
        sig_list = getattr(ev, "signals", []) or []
        res_list = getattr(ev, "analysis_results", []) or []

        ev_dict = {
            "evidence_id": str(ev.id),
            "file_hash": str(ev.file_hash or ""),
            "mime_type": str(ev.mime_type or ""),
            "storage_key": str(ev.storage_key or ""),
            "observations": sorted([
                {
                    "signal_type": str(o.signal_type),
                    "value": str(o.value),
                    "representation": str(o.representation or ""),
                    "provenance": str(o.provenance or "")
                } for o in obs_list
            ], key=lambda x: (x["signal_type"], x["value"])),
            "signals": sorted([
                {
                    "signal_type": str(s.signal_type),
                    "model_id": str(s.model_id or ""),
                    "model_version": str(s.model_version or ""),
                    "value": str(s.value),
                    "confidence_semantics": str(s.confidence_semantics or "")
                } for s in sig_list
            ], key=lambda x: (x["signal_type"], x["model_id"])),
            "analysis_results": sorted([
                {
                    "verdict": str(r.verdict),
                    "ensemble_score": float(r.ensemble_score or 0.0),
                    "policy_version": str(getattr(r.policy, "version", "Unknown")) if getattr(r, "policy", None) else "Unknown"
                } for r in res_list
            ], key=lambda x: x["verdict"])
        }
        canonical_data["evidence_items"].append(ev_dict)

    canonical_json = json.dumps(canonical_data, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(canonical_json.encode("utf-8")).hexdigest()


def _prepare_image_flowable(img_bytes: bytes, max_width: float = 250, max_height: float = 170) -> Optional[RLImage]:
    """Scales image bytes to fit within bounding dimensions while preserving aspect ratio and optimizing memory."""
    try:
        with PILImage.open(io.BytesIO(img_bytes)) as pil_img:
            if pil_img.mode in ("RGBA", "LA") or (pil_img.mode == "P" and "transparency" in pil_img.info):
                pil_img = pil_img.convert("RGBA")
            else:
                pil_img = pil_img.convert("RGB")

            orig_w, orig_h = pil_img.size
            if orig_w == 0 or orig_h == 0:
                return None
            ratio = min(max_width / orig_w, max_height / orig_h)
            target_w = orig_w * ratio
            target_h = orig_h * ratio

            thumb_w = max(1, int(target_w * 2))
            thumb_h = max(1, int(target_h * 2))
            pil_img.thumbnail((thumb_w, thumb_h), PILImage.Resampling.LANCZOS)

            buf = io.BytesIO()
            pil_img.save(buf, format="PNG", optimize=True)
            buf.seek(0)
            return RLImage(buf, width=target_w, height=target_h)
    except Exception:
        return None


async def generate_pdf_report(
    investigation: Any,
    investigator_email: str,
    evidence_id_filter: Optional[str] = None
) -> bytes:
    """
    Generates an authoritative, tamper-evident Forensic PDF Report
    built directly from persisted PostgreSQL ledger data.
    """
    storage = get_storage_provider()
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=40,
        rightMargin=40,
        topMargin=55,
        bottomMargin=55
    )

    styles = getSampleStyleSheet()

    # Custom Brand Typography Styles
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=colors.HexColor('#0f172a'),
        spaceAfter=3
    )
    subtitle_style = ParagraphStyle(
        'DocSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#0891b2'),
        textTransform='uppercase',
        spaceAfter=10
    )
    section_h1 = ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor('#0f172a'),
        spaceBefore=10,
        spaceAfter=5
    )
    section_h2 = ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=12.5,
        textColor=colors.HexColor('#1e293b'),
        spaceBefore=8,
        spaceAfter=4
    )
    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=11,
        textColor=colors.HexColor('#334155')
    )
    mono_style = ParagraphStyle(
        'Mono',
        parent=styles['Normal'],
        fontName='Courier',
        fontSize=7,
        leading=9,
        textColor=colors.HexColor('#0f172a')
    )
    table_header = ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=9.5,
        textColor=colors.white
    )
    table_cell = ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor('#1e293b')
    )
    disclaimer_style = ParagraphStyle(
        'Disclaimer',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7,
        leading=9.5,
        textColor=colors.HexColor('#475569')
    )

    story = []

    # Title & Metadata Block
    story.append(Paragraph("DEEPVERIFY FORENSIC CASE REPORT", title_style))
    story.append(Paragraph("Authoritative Evidence Synthesis & Verification Dossier", subtitle_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor('#0891b2'), spaceBefore=0, spaceAfter=8))

    # Case Overview Metadata Table
    now_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    doc_id = uuid.uuid4().hex[:12].upper()
    
    case_meta = [
        [
            Paragraph("<b>Case Title:</b>", body_style),
            Paragraph(f"<b>{safe_text(investigation.title)}</b>", body_style),
            Paragraph("<b>Report Date:</b>", body_style),
            Paragraph(now_utc, body_style)
        ],
        [
            Paragraph("<b>Case ID:</b>", body_style),
            Paragraph(f"<code>{safe_text(investigation.id)}</code>", mono_style),
            Paragraph("<b>Investigator:</b>", body_style),
            Paragraph(safe_text(investigator_email), body_style)
        ],
        [
            Paragraph("<b>Status:</b>", body_style),
            Paragraph(safe_text(getattr(investigation, 'status', 'OPEN')), body_style),
            Paragraph("<b>Document ID:</b>", body_style),
            Paragraph(f"<code>{doc_id}</code>", mono_style)
        ]
    ]
    t_case = Table(case_meta, colWidths=[75, 191, 85, 181])
    t_case.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(t_case)
    story.append(Spacer(1, 8))

    # Investigator Case Notes
    if getattr(investigation, 'notes', None):
        story.append(Paragraph("Investigator Qualitative Notes", section_h2))
        notes_table = Table([[Paragraph(safe_multiline(investigation.notes), body_style)]], colWidths=[532])
        notes_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ]))
        story.append(notes_table)
        story.append(Spacer(1, 8))

    # Evidence Items Scope
    all_evidence = getattr(investigation, 'evidence_items', []) or []
    if evidence_id_filter:
        target_items = [e for e in all_evidence if e.id == evidence_id_filter]
    else:
        target_items = sorted(
            all_evidence,
            key=lambda e: (str(getattr(e, 'created_at', '') or ''), str(e.id))
        )

    # Compute Deterministic Canonical Ledger Seal
    canonical_digest = compute_canonical_ledger_digest(investigation, target_items)

    if not target_items:
        story.append(Paragraph("<i>No evidence items recorded in this case.</i>", body_style))
    else:
        for idx, ev in enumerate(target_items, start=1):
            if idx > 1:
                story.append(Spacer(1, 14))
                story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=4, spaceAfter=10))

            ev_header_text = f"Evidence Item #{idx}: {safe_text(ev.id[:8])}... ({safe_text(ev.mime_type)})"
            story.append(Paragraph(ev_header_text, section_h1))

            # 1. Evidence Provenance & Cryptographic Integrity Table
            ev_meta_data = [
                [
                    Paragraph("<b>Evidence ID:</b>", body_style),
                    Paragraph(f"<code>{safe_text(ev.id)}</code>", mono_style),
                    Paragraph("<b>MIME Type:</b>", body_style),
                    Paragraph(safe_text(ev.mime_type), body_style)
                ],
                [
                    Paragraph("<b>SHA-256 Digest:</b>", body_style),
                    Paragraph(f"<code>{safe_text(ev.file_hash or 'Uncomputed')}</code>", mono_style),
                    Paragraph("<b>Storage Key:</b>", body_style),
                    Paragraph(f"<code>{safe_text(ev.storage_key or 'Not stored')}</code>", mono_style)
                ]
            ]
            t_ev_meta = Table(ev_meta_data, colWidths=[80, 240, 72, 140])
            t_ev_meta.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))
            story.append(t_ev_meta)
            story.append(Spacer(1, 7))

            # 2. Deterministic Media Observations
            observations = getattr(ev, 'observations', []) or []
            story.append(Paragraph("1. Deterministic Media Observations", section_h2))
            if observations:
                obs_rows = [[
                    Paragraph("Observation Type", table_header),
                    Paragraph("Value", table_header),
                    Paragraph("Representation", table_header),
                    Paragraph("Provenance", table_header)
                ]]
                for o in observations:
                    obs_rows.append([
                        Paragraph(f"<b>{safe_text(o.signal_type)}</b>", table_cell),
                        Paragraph(f"<code>{safe_text(o.value)}</code>", table_cell),
                        Paragraph(safe_text(o.representation or "N/A"), table_cell),
                        Paragraph(safe_text(o.provenance or "Backend Extraction"), table_cell)
                    ])
                t_obs = Table(obs_rows, colWidths=[120, 100, 162, 150])
                t_obs.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0f172a')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(t_obs)
            else:
                story.append(Paragraph("<i>No deterministic image geometry observations recorded in ledger.</i>", body_style))
            story.append(Spacer(1, 7))

            # 3. Probabilistic Model Signals & Policy Classification
            results = getattr(ev, 'analysis_results', []) or []
            signals = getattr(ev, 'signals', []) or []
            jobs = getattr(ev, 'jobs', []) or []
            primary_res = results[0] if results else None
            primary_job = jobs[0] if jobs else None

            story.append(Paragraph("2. Probabilistic Model Signals & Policy Classification", section_h2))

            if primary_res:
                verdict = primary_res.verdict
                ensemble_score = float(primary_res.ensemble_score or 0) * 100
                is_authentic = verdict == "LIKELY_AUTHENTIC"
                
                v_bg = colors.HexColor('#ecfdf5') if is_authentic else colors.HexColor('#fef2f2')
                v_border = colors.HexColor('#10b981') if is_authentic else colors.HexColor('#ef4444')
                v_text_color = '#047857' if is_authentic else '#b91c1c'
                
                pol_ver = getattr(primary_res.policy, 'version', 'ensemble-v1.0') if getattr(primary_res, 'policy', None) else 'ensemble-v1.0'
                pol_thresh = getattr(primary_res.policy, 'decision_threshold', 0.5) if getattr(primary_res, 'policy', None) else 0.5
                pol_hash = getattr(primary_res.policy, 'configuration_hash', 'N/A') if getattr(primary_res, 'policy', None) else 'N/A'

                finding_text = "Analysis indicates no significant synthetic structural anomalies." if is_authentic else "Analysis indicates structural anomalies commonly associated with synthetic generation." if verdict == "LIKELY_AI_GENERATED" else "Analysis in progress or unavailable."

                verdict_p = Paragraph(
                    f"<b>PRIMARY FINDING:</b> <font color='{v_text_color}'><b>{finding_text}</b></font><br/>"
                    f"Indicative Analysis Score: <b>{ensemble_score:.1f}</b> "
                    f"&nbsp;&nbsp;|&nbsp;&nbsp; Policy: <code>{safe_text(pol_ver)}</code><br/>"
                    f"<i>* This score is an uncalibrated indicative model output based on the policy. It is not a definitive probability.</i>",
                    body_style
                )
                t_verdict = Table([[verdict_p]], colWidths=[532])
                t_verdict.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), v_bg),
                    ('BOX', (0, 0), (-1, -1), 1, v_border),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 7),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 7),
                ]))
                story.append(t_verdict)
                story.append(Spacer(1, 5))
            else:
                # Honestly represent analysis job status when results are absent
                if primary_job:
                    j_status = primary_job.status
                    if j_status == "FAILED":
                        err_text = safe_text(primary_job.error_message or "Unknown pipeline exception")
                        status_p = Paragraph(
                            f"<b>ANALYSIS STATUS: FAILED</b><br/>"
                            f"The analysis job encountered an error: <i>{err_text}</i>. Model signals could not be computed.",
                            body_style
                        )
                        s_bg = colors.HexColor('#fef2f2')
                        s_border = colors.HexColor('#ef4444')
                    else:
                        status_p = Paragraph(
                            f"<b>ANALYSIS STATUS: {safe_text(j_status)}</b><br/>"
                            f"The evidence item is currently being processed by the backend pipeline. Final results are pending.",
                            body_style
                        )
                        s_bg = colors.HexColor('#f8fafc')
                        s_border = colors.HexColor('#94a3b8')
                else:
                    status_p = Paragraph(
                        "<b>ANALYSIS STATUS: NOT ANALYZED</b><br/>"
                        "This evidence item has not been submitted to the automated forensic analysis pipeline.",
                        body_style
                    )
                    s_bg = colors.HexColor('#f8fafc')
                    s_border = colors.HexColor('#cbd5e1')

                t_status = Table([[status_p]], colWidths=[532])
                t_status.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, -1), s_bg),
                    ('BOX', (0, 0), (-1, -1), 0.5, s_border),
                    ('TOPPADDING', (0, 0), (-1, -1), 4),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
                    ('LEFTPADDING', (0, 0), (-1, -1), 6),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 6),
                ]))
                story.append(t_status)
                story.append(Spacer(1, 5))

            if signals:
                sig_rows = [[
                    Paragraph("Signal Type", table_header),
                    Paragraph("Model ID", table_header),
                    Paragraph("Version", table_header),
                    Paragraph("Score / Value", table_header),
                    Paragraph("Confidence Semantics", table_header)
                ]]
                for s in signals:
                    disp_val = format_signal_display(s.signal_type, s.value, s.confidence_semantics)
                    sig_rows.append([
                        Paragraph(f"<b>{safe_text(s.signal_type)}</b>", table_cell),
                        Paragraph(safe_text(s.model_id or "N/A"), table_cell),
                        Paragraph(safe_text(s.model_version or "1.0"), table_cell),
                        Paragraph(disp_val, table_cell),
                        Paragraph(safe_text(s.confidence_semantics or "AI_PROBABILITY"), table_cell)
                    ])
                t_sig = Table(sig_rows, colWidths=[130, 115, 52, 105, 130])
                t_sig.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0891b2')),
                    ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                    ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                    ('TOPPADDING', (0, 0), (-1, -1), 2.5),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
                    ('LEFTPADDING', (0, 0), (-1, -1), 4),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                ]))
                story.append(t_sig)
            else:
                story.append(Paragraph("<i>No model signals recorded for this evidence item.</i>", body_style))
            story.append(Spacer(1, 7))

            # 4. Evidence Visual Examination & Heatmap Embeddings
            orig_flowable = None
            heat_flowable = None

            if ev.storage_key:
                try:
                    orig_bytes = await storage.get_file(ev.storage_key)
                    orig_flowable = _prepare_image_flowable(orig_bytes, max_width=255, max_height=170)
                except Exception:
                    orig_flowable = None

            if primary_res and primary_res.ai_explanation:
                try:
                    heat_bytes = await storage.get_file(primary_res.ai_explanation)
                    heat_flowable = _prepare_image_flowable(heat_bytes, max_width=255, max_height=170)
                except Exception:
                    heat_flowable = None

            col_orig = [
                Paragraph("<b>Original Evidence Asset</b>", body_style),
                orig_flowable or Paragraph("<i>[Image asset not accessible in storage]</i>", body_style)
            ]
            col_heat = [
                Paragraph("<b>Model Attention Visualization</b>", body_style),
                heat_flowable or Paragraph("<i>[Spatial heatmap not generated or unavailable. A missing heatmap indicates the evaluated policy did not produce spatial saliency, and does not constitute proof of authenticity or manipulation.]</i>", body_style)
            ]

            img_table = Table([[col_orig, col_heat]], colWidths=[266, 266])
            img_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
                ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
                ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('TOPPADDING', (0, 0), (-1, -1), 5),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
                ('LEFTPADDING', (0, 0), (-1, -1), 5),
                ('RIGHTPADDING', (0, 0), (-1, -1), 5),
            ]))

            caption_p = Paragraph(
                "<b>Caption:</b> This visualization highlights areas of model attention based on convolutional gradients. "
                "It is an interpretive tool to guide investigation, not absolute proof of manipulation.",
                disclaimer_style
            )

            visual_block = [
                Paragraph("3. Evidence Inspection & Saliency Topography", section_h2),
                img_table,
                Spacer(1, 3),
                caption_p,
                Spacer(1, 8)
            ]
            story.append(KeepTogether(visual_block))

    # Scientific Grounding & Evidentiary Boundaries (Section G)
    receipt_hash = hashlib.sha256(f"{canonical_digest}:{investigator_email}:{now_utc}:{doc_id}".encode()).hexdigest()

    story.append(KeepTogether([
        Paragraph("Scientific Grounding & Evidentiary Boundaries", section_h1),
        Table([
            [Paragraph(
                "<b>MANDATORY SCIENTIFIC HONESTY DISCLAIMER (V2 Section G Grounding Rules):</b><br/>"
                "1. <b>Probabilistic Boundaries:</b> Model scores represent statistical likelihoods under the evaluated policy and model architecture versions. They do not constitute absolute legal proof or physical certainty.<br/>"
                "2. <b>Separation of Observations & Signals:</b> Deterministic metadata and geometry observations (format, resolution) are verified empirical file attributes. Container metadata or compression artifacts do not independently establish image tampering.<br/>"
                "3. <b>Grad-CAM Saliency:</b> Activation heatmaps reflect neural network feature sensitivity and must never be interpreted as causal manipulation boundaries.<br/>"
                "4. <b>Auditability:</b> Results are bound to the pinned SHA-256 digest of the ingested asset and their respective policy configurations.",
                disclaimer_style
            )]
        ], colWidths=[532], style=[
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#94a3b8')),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 7),
            ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ]),
        Spacer(1, 6),
        # Cryptographic Audit Ledger Seal & Document Receipt
        Table([
            [
                Paragraph("<b>Canonical Ledger Digest:</b>", body_style),
                Paragraph(f"<code>SHA256: {canonical_digest}</code>", mono_style)
            ],
            [
                Paragraph("<b>Scope & Integrity:</b>", body_style),
                Paragraph("Deterministic digest computed over all case records, pinned evidence SHA-256 hashes, physical observations, model signals, and policy verdicts in scope. Verifiable against PostgreSQL ledger.", disclaimer_style)
            ],
            [
                Paragraph("<b>Document Receipt:</b>", body_style),
                Paragraph(f"<code>SHA256: {receipt_hash}</code> (Issued: {now_utc})", mono_style)
            ]
        ], colWidths=[125, 407], style=[
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1')),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('TOPPADDING', (0, 0), (-1, -1), 3),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ('LEFTPADDING', (0, 0), (-1, -1), 5),
            ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ])
    ]))

    # Build PDF with NumberedCanvas
    doc.build(story, canvasmaker=NumberedCanvas)
    buffer.seek(0)
    return buffer.getvalue()
