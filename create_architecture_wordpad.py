import os
import re
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

WORKSPACE = Path(r"c:\Users\sadik\Documents\antigravity\adventurous-raman")
FOLDER = WORKSPACE / "Detecting Criminal Activities from CCTV"

DOCX_OUT_FOLDER = FOLDER / "System_Architecture_WordPad.docx"
RTF_OUT_FOLDER = FOLDER / "System_Architecture_WordPad.rtf"
DOCX_OUT_ROOT = WORKSPACE / "System_Architecture_WordPad.docx"
RTF_OUT_ROOT = WORKSPACE / "System_Architecture_WordPad.rtf"

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def create_system_architecture_document():
    doc = docx.Document()

    # 1 inch standard margins
    for s in doc.sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    # Base styling
    normal = doc.styles['Normal']
    normal.font.name = 'Calibri'
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor(30, 41, 59)

    # Document Header Title
    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(4)
    run_t = title_p.add_run("DETECTING CRIMINAL ACTIVITIES FROM CCTV USING OBJECT DETECTION AND MACHINE LEARNING ALGORITHMS")
    run_t.font.name = 'Calibri'
    run_t.font.size = Pt(16)
    run_t.font.bold = True
    run_t.font.color.rgb = RGBColor(15, 23, 42)

    sub_p = doc.add_paragraph()
    sub_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    sub_p.paragraph_format.space_after = Pt(18)
    run_sub = sub_p.add_run("CHAPTER 05: SYSTEM ARCHITECTURE & STEP-BY-STEP OPERATIONAL WORKFLOW")
    run_sub.font.name = 'Calibri'
    run_sub.font.size = Pt(12)
    run_sub.font.bold = True
    run_sub.font.color.rgb = RGBColor(30, 58, 138)

    # Divider line
    div_p = doc.add_paragraph()
    div_p.paragraph_format.space_after = Pt(14)
    r_div = div_p.add_run("_________________________________________________________________________________")
    r_div.font.color.rgb = RGBColor(203, 213, 225)
    r_div.font.size = Pt(9)

    # Section 5.1
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(10)
    h1.paragraph_format.space_after = Pt(6)
    r1 = h1.add_run("5.1 Architectural Definition: How the System Works Step-by-Step")
    r1.font.size = Pt(13)
    r1.font.bold = True
    r1.font.color.rgb = RGBColor(30, 58, 138)

    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(10)
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.add_run(
        "The system architecture defines the end-to-end operational pipeline that transforms raw surveillance camera video "
        "streams into verified criminal threat intelligence, automated video evidence, and real-time security alerts. "
        "The complete system operates across seven structured, sequential stages executed continuously by background daemon "
        "threads and asynchronous services on commodity multi-core CPU hardware."
    )

    # Step-by-step Process Flow Box (Structured Table representation for clean display in Word)
    flow_steps = [
        ("STAGE 1: VIDEO INGESTION & CAPTURE", 
         "Input: CCTV IP Cameras, RTSP Streams, Webcams, or Pre-recorded Video Files (MP4/AVI).\n"
         "Action: Multi-threaded CameraStreamManager spawns a dedicated daemon thread running OpenCV cv2.VideoCapture with TCP transport (rtsp_transport=tcp) to prevent frame drop.\n"
         "Output: Continuous uncompressed video frame stream at 25-30 FPS in memory."),

        ("STAGE 2: PREPROCESSING & CIRCULAR BUFFERING", 
         "Input: Raw frames from Stage 1.\n"
         "Action 1 (Decoupling): Subsampler extracts 1 frame every 200ms (5 FPS target) for AI inference, keeping CPU usage low.\n"
         "Action 2 (RAM Buffer): Every incoming frame is stored into an in-memory double-ended circular buffer (collections.deque) retaining exactly 3.0 seconds of pre-event historical video.\n"
         "Output: Normalized 640x480 RGB tensors for AI and continuous rolling pre-event RAM buffer."),

        ("STAGE 3: DEEP LEARNING OBJECT DETECTION (YOLOv8n)", 
         "Input: Subsampled 640x480 RGB image tensor.\n"
         "Action: Ultralytics YOLOv8n deep neural network performs a forward pass via multi-core PyTorch CPU SIMD/AVX-512 optimization.\n"
         "- Backbone: Modified CSPDarknet53 extracts spatial feature pyramids.\n"
         "- Dual Models: yolov8n.pt detects people/crowd telemetry; yolov8n_weapon.pt detects handguns, knives, and weapons.\n"
         "- Post-Processing: Non-Maximum Suppression (NMS, IoU threshold = 0.45) eliminates duplicate candidate boxes.\n"
         "Output: Candidate bounding box coordinates, class labels, and confidence probability scores [0.0 - 1.0]."),

        ("STAGE 4: TEMPORAL MULTI-FRAME CONFIRMATION GATE", 
         "Input: Candidate detections across consecutive frames.\n"
         "Action (False-Positive Elimination): To prevent false alarms caused by momentary shadows, glares, or handheld items, the temporal weapon tracker checks spatial continuity across time using Euclidean centroid distance matching.\n"
         "Trigger Rule: A threat event is confirmed ONLY if weapon confidence exceeds threshold (e.g. >= 0.35) for K >= 2 consecutive frames.\n"
         "Output: Verified Criminal Threat Event Trigger Signal (Transient 1-frame glitches are silently dropped)."),

        ("STAGE 5: AUTOMATED FORENSIC EVIDENCE GENERATION", 
         "Input: Trigger signal from Stage 4.\n"
         "Action 1 (Pre-Roll): Manager freezes and dumps the 3.0-second circular RAM buffer (exact footage before the threat occurred).\n"
         "Action 2 (Post-Roll): Manager captures ongoing incoming frames for an additional 3.0 seconds.\n"
         "Action 3 (Encoding): The combined 6.0-second frame sequence is encoded into an MP4 video clip (AVC1 codec) in storage/incidents/.\n"
         "Action 4 (Thumbnail): The frame with the highest confidence is extracted and saved as an annotated high-resolution JPEG thumbnail.\n"
         "Output: Certified 6.0-second MP4 evidence video and JPEG thumbnail with zero pre-event footage loss."),

        ("STAGE 6: DATABASE PERSISTENCE & AUDIT LOGGING", 
         "Input: Incident metadata, camera identifier, threat type, confidence score, and media file paths.\n"
         "Action: Asynchronous SQLAlchemy session executes an atomic write transaction to SQLite 3 in Write-Ahead Logging (WAL) mode.\n"
         "- WAL mode permits concurrent dashboard reads while workers record incidents without table locking.\n"
         "- Foreign-key relationships link incidents to the parent camera and video analysis jobs.\n"
         "Output: Permanent incident audit record stored in SQLite cctv_surveillance.db."),

        ("STAGE 7: REAL-TIME OPERATOR ALERTING & RBAC TRIAGE", 
         "Input: Database event and live camera feeds.\n"
         "Action: Web application serves live MJPEG video streams and triggers real-time visual and acoustic alarms.\n"
         "- Role-Based Access Control (RBAC):\n"
         "  * Field Operator: Views live CCTV grid and monitors threat alerts (Read-Only).\n"
         "  * Threat Analyst: Reviews evidentiary clips, acknowledges incidents, triages false alarms, and exports forensic reports.\n"
         "  * System Administrator: Full control to adjust AI confidence thresholds, configure cameras, and tune system hyperparameters.\n"
         "Output: Real-time command center interface running in React 18 / Vite single-page application.")
    ]

    # Render Process Workflow Table
    tbl = doc.add_table(rows=len(flow_steps) + 1, cols=2)
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr = tbl.rows[0]
    hdr.cells[0].text = "PIPELINE STAGE"
    hdr.cells[1].text = "STEP-BY-STEP OPERATIONAL PROCESS DESCRIPTION"
    set_cell_background(hdr.cells[0], "1E3A8A")
    set_cell_background(hdr.cells[1], "1E3A8A")

    for c in hdr.cells:
        for p in c.paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(10)

    # Set column widths
    hdr.cells[0].width = Inches(2.2)
    hdr.cells[1].width = Inches(4.3)

    for idx, (stage_name, desc) in enumerate(flow_steps):
        row = tbl.rows[idx + 1]
        row.cells[0].width = Inches(2.2)
        row.cells[1].width = Inches(4.3)

        row.cells[0].text = stage_name
        row.cells[1].text = desc

        bg = "F8FAFC" if (idx % 2 == 1) else "FFFFFF"
        set_cell_background(row.cells[0], bg)
        set_cell_background(row.cells[1], bg)

        p0 = row.cells[0].paragraphs[0]
        for r in p0.runs:
            r.font.bold = True
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(30, 58, 138)

        p1 = row.cells[1].paragraphs[0]
        p1.paragraph_format.line_spacing = 1.15
        for r in p1.runs:
            r.font.size = Pt(9.5)
            r.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph()

    # Section 5.2: Multi-Layer Architectural Breakdown
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(14)
    h2.paragraph_format.space_after = Pt(6)
    r2 = h2.add_run("5.2 Layered System Architecture Breakdown")
    r2.font.size = Pt(13)
    r2.font.bold = True
    r2.font.color.rgb = RGBColor(30, 58, 138)

    layers_info = [
        ("Layer 1: Presentation & User Experience (UI)", 
         "Built with React 18, TypeScript, Tailwind CSS, and Vite. Provides an operator console featuring multi-camera live grid viewing (MJPEG), forensic video batch upload, incident review triage center, weapon detection validation dashboard, and evidence video library. Enforces client-side clearance gating according to user role."),

        ("Layer 2: API Gateway & Application Server", 
         "Implemented in FastAPI (Python 3.11) running on Uvicorn ASGI server. Exposes high-throughput asynchronous RESTful endpoints (/api/v1/cameras, /api/v1/videos, /api/v1/incidents, /api/v1/settings, /api/v1/health) and handles non-blocking multipart/x-mixed-replace live MJPEG video streaming directly to client web browsers."),

        ("Layer 3: Computer Vision & AI Inference Engine", 
         "Powered by Ultralytics YOLOv8n running directly on multi-core CPU with SIMD and AVX-512 hardware acceleration. Incorporates dual deep learning models: standard COCO weights (80 classes including person and vehicle telemetry) and a specialized weapon detection network trained on firearms, knives, and edged weapons."),

        ("Layer 4: Stream Ingestion & Multi-Threading Manager", 
         "The CameraStreamManager spawns isolated background daemon threads per CCTV camera endpoint. Each thread interfaces with OpenCV VideoCapture over TCP RTSP, decouples incoming socket ingestion (25 FPS) from neural inference (5 FPS), and maintains an in-memory double-ended circular buffer (collections.deque) holding 3.0 seconds of pre-event video."),

        ("Layer 5: Temporal Tracking & Evidence Serialization", 
         "The weapon tracker monitors candidate detections across consecutive sampled frames using centroid distance tracking. Upon confirming a persistent threat across K >= 2 frames, it triggers automated packaging of a 6.0-second MP4 evidence video (3s pre-event + 3s post-event) and a peak-confidence JPEG keyframe thumbnail."),

        ("Layer 6: Relational Persistence & Storage Subsystem", 
         "SQLite 3 database configured in asynchronous Write-Ahead Logging (WAL) mode via SQLAlchemy 2.0. WAL mode allows concurrent dashboard readers to query incident logs without encountering database locks during video writes. Storage vaults organize recordings into /storage/incidents/, uploads into /storage/uploads/, and weights into /storage/models/."),

        ("Layer 7: Role-Based Access Control (RBAC) Governance", 
         "A three-tier security access model dividing responsibilities between System Administrator (full clearance, camera hardware control, AI threshold tuning), Threat Analyst (incident triage, video analysis, report exports), and Field Operator (real-time camera viewing and read-only alert monitoring).")
    ]

    for title, desc in layers_info:
        p_l = doc.add_paragraph()
        p_l.paragraph_format.space_before = Pt(6)
        p_l.paragraph_format.space_after = Pt(4)
        p_l.paragraph_format.line_spacing = 1.15
        
        r_t = p_l.add_run(f"• {title}: ")
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(14, 116, 144)
        
        r_d = p_l.add_run(desc)
        r_d.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph()

    # Section 5.3: Step-by-Step Data Flow Sequence
    h3 = doc.add_paragraph()
    h3.paragraph_format.space_before = Pt(14)
    h3.paragraph_format.space_after = Pt(6)
    r3 = h3.add_run("5.3 Detailed Step-by-Step Data Flow Sequence")
    r3.font.size = Pt(13)
    r3.font.bold = True
    r3.font.color.rgb = RGBColor(30, 58, 138)

    steps = [
        ("Step 1: Network Stream Connection", "The system establishes an RTSP TCP video connection to the camera (or local webcam/video file)."),
        ("Step 2: Continuous Ring Buffer Ingestion", "Raw frames arrive at 25-30 FPS and are continuously queued into a 3.0-second RAM circular buffer."),
        ("Step 3: Adaptive Frame Subsampling", "Every 200 milliseconds (5 FPS), a frame is dispatched to the YOLOv8n deep learning inference engine."),
        ("Step 4: Image Normalization & Forward Pass", "The frame is resized to 640x480 RGB, normalized to [0.0, 1.0], and evaluated by YOLOv8n to extract bounding boxes and confidence scores."),
        ("Step 5: Non-Maximum Suppression (NMS)", "Overlapping redundant boxes are eliminated using an IoU threshold of 0.45."),
        ("Step 6: Temporal Continuity Validation", "The temporal tracking gate checks if the detected weapon maintains spatial continuity across K consecutive frames (default K = 2). Single-frame false alarms are discarded."),
        ("Step 7: Incident Trigger Activation", "When confirmed, an incident trigger is fired with camera ID, timestamp, and threat class."),
        ("Step 8: Automated Evidence Clip Assembly", "The stream manager extracts the 3.0 seconds of pre-event footage from the RAM ring buffer, appends 3.0 seconds of post-event footage, and writes a 6.0-second MP4 evidence video."),
        ("Step 9: Keyframe Thumbnail Extraction", "The exact frame with peak detection confidence is annotated with bounding boxes and saved as a high-resolution JPEG thumbnail."),
        ("Step 10: Asynchronous Database Commit", "An incident record containing timestamp, camera name, threat category, confidence score, and media paths is committed to SQLite (WAL mode)."),
        ("Step 11: Real-Time Command Center Broadcast", "The web dashboard instantly displays audio-visual threat alerts, updates the unreviewed incident counter, and highlights the affected camera feed."),
        ("Step 12: Role-Based Review & Forensic Triage", "A logged-in Threat Analyst or Administrator reviews the 6-second evidence clip, confirms or dismisses the incident, and exports certified forensic reports.")
    ]

    for num, (st_name, st_desc) in enumerate(steps, 1):
        p_st = doc.add_paragraph()
        p_st.paragraph_format.space_before = Pt(3)
        p_st.paragraph_format.space_after = Pt(3)
        p_st.paragraph_format.line_spacing = 1.15

        r_num = p_st.add_run(f"{num}. {st_name}: ")
        r_num.font.bold = True
        r_num.font.color.rgb = RGBColor(30, 58, 138)

        r_desc = p_st.add_run(st_desc)
        r_desc.font.color.rgb = RGBColor(51, 65, 85)

    doc.add_paragraph()

    # Section 5.4: Role-Based Workflow Execution Matrix
    h4 = doc.add_paragraph()
    h4.paragraph_format.space_before = Pt(14)
    h4.paragraph_format.space_after = Pt(6)
    r4 = h4.add_run("5.4 Role-Based Workflow Execution Matrix")
    r4.font.size = Pt(13)
    r4.font.bold = True
    r4.font.color.rgb = RGBColor(30, 58, 138)

    rbac_rows = [
        ("Live Multi-Camera Monitoring", "Full Viewing & Stream Controls", "Viewing Enabled", "Real-Time Viewing Enabled"),
        ("Incident Center & Alert Triage", "Full Triage & Status Review", "Full Triage & Status Review", "Read-Only (Alerts Monitoring)"),
        ("Forensic Video Batch Analysis", "Full Upload & Batch Processing", "Full Upload & Batch Processing", "Access Blocked (Restricted)"),
        ("Weapon Detection Validation", "Full Model & Threshold Validation", "Full Model & Threshold Validation", "Access Blocked (Restricted)"),
        ("Forensic Reports & Data Export", "Full CSV/JSON Export & Printing", "Full CSV/JSON Export & Printing", "Access Blocked (Restricted)"),
        ("CCTV Camera Provisioning", "Add, Edit RTSP, Delete Cameras", "Access Blocked (Restricted)", "Access Blocked (Restricted)"),
        ("AI Thresholds & Governance", "Modify FPS, Thresholds & RBAC", "Access Blocked (Restricted)", "Access Blocked (Restricted)")
    ]

    tbl_rbac = doc.add_table(rows=len(rbac_rows) + 1, cols=4)
    tbl_rbac.style = 'Table Grid'
    tbl_rbac.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr_r = tbl_rbac.rows[0]
    hdr_r.cells[0].text = "SYSTEM FUNCTION"
    hdr_r.cells[1].text = "ADMINISTRATOR"
    hdr_r.cells[2].text = "THREAT ANALYST"
    hdr_r.cells[3].text = "FIELD OPERATOR"

    for c in hdr_r.cells:
        set_cell_background(c, "1E3A8A")
        for p in c.paragraphs:
            for r in p.runs:
                r.font.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(9.5)

    hdr_r.cells[0].width = Inches(2.0)
    hdr_r.cells[1].width = Inches(1.5)
    hdr_r.cells[2].width = Inches(1.5)
    hdr_r.cells[3].width = Inches(1.5)

    for idx, (func, adm, anl, opr) in enumerate(rbac_rows):
        row = tbl_rbac.rows[idx + 1]
        row.cells[0].width = Inches(2.0)
        row.cells[1].width = Inches(1.5)
        row.cells[2].width = Inches(1.5)
        row.cells[3].width = Inches(1.5)

        row.cells[0].text = func
        row.cells[1].text = adm
        row.cells[2].text = anl
        row.cells[3].text = opr

        bg = "F8FAFC" if (idx % 2 == 1) else "FFFFFF"
        for c in row.cells:
            set_cell_background(c, bg)
            p = c.paragraphs[0]
            for r in p.runs:
                r.font.size = Pt(9)
                r.font.color.rgb = RGBColor(51, 65, 85)
                if "Blocked" in r.text or "Restricted" in r.text:
                    r.font.color.rgb = RGBColor(185, 28, 28) # Red for restricted
                elif "Full" in r.text:
                    r.font.color.rgb = RGBColor(16, 120, 72) # Green for full access

    # Save DOCX files
    doc.save(str(DOCX_OUT_FOLDER))
    doc.save(str(DOCX_OUT_ROOT))
    print(f"Generated clean DOCX: {DOCX_OUT_FOLDER}")
    print(f"Generated clean DOCX: {DOCX_OUT_ROOT}")

def create_system_architecture_rtf():
    # Native RTF document for WordPad
    header = (
        r"{\rtf1\ansi\ansicpg1252\deff0\nouicompat\deflang1033"
        r"{\fonttbl{\f0\fnil\fcharset0 Calibri;}{\f1\fnil\fcharset0 Arial;}{\f2\fnil\fcharset0 Consolas;}}"
        r"{\colortbl ;\red15\green23\blue42;\red30\green58\blue138;\red14\green116\blue144;\red71\green85\blue105;\red185\green28\blue28;\red16\green120\blue72;\red203\green213\blue225;}"
        r"\viewkind4\uc1 "
        r"\paperw12240\paperh15840\margl1440\margr1440\margt1440\margb1440 "
    )

    def esc(text):
        res = ""
        for char in text:
            code = ord(char)
            if char == '\\':
                res += "\\\\"
            elif char == '{':
                res += "\\{"
            elif char == '}':
                res += "\\}"
            elif code < 128:
                res += char
            else:
                res += f"\\u{code}?"
        return res

    body = []
    # Title
    body.append(r"\pard\qc\sa160\sb100\f0\fs32\b\cf1 DETECTING CRIMINAL ACTIVITIES FROM CCTV USING OBJECT DETECTION AND MACHINE LEARNING ALGORITHMS\b0\par ")
    body.append(r"\pard\qc\sa240\f0\fs24\b\cf2 CHAPTER 05: SYSTEM ARCHITECTURE & STEP-BY-STEP OPERATIONAL WORKFLOW\b0\par ")
    body.append(r"\pard\sa200\cf7 _________________________________________________________________________________\cf1\par ")

    # 5.1 Overview
    body.append(r"\pard\sa160\sb140\f0\fs26\b\cf2 5.1 Architectural Definition: How the System Works Step-by-Step\b0\par ")
    body.append(r"\pard\sa180\sl276\slmult1\f0\fs22\cf1 The system architecture defines the end-to-end operational pipeline that transforms raw surveillance camera video streams into verified criminal threat intelligence, automated video evidence, and real-time security alerts. The complete system operates across seven structured, sequential stages executed continuously by background daemon threads and asynchronous services on commodity multi-core CPU hardware.\par ")

    # Stages
    stages = [
        ("STAGE 1: VIDEO INGESTION & CAPTURE", [
            ("Input", "CCTV IP Cameras, RTSP Streams, Webcams, or Pre-recorded Video Files (MP4/AVI)."),
            ("Action", "Multi-threaded CameraStreamManager spawns a dedicated daemon thread running OpenCV cv2.VideoCapture with TCP transport (rtsp_transport=tcp) to eliminate packet loss and video tearing."),
            ("Output", "Continuous uncompressed video frame stream at 25-30 FPS in memory.")
        ]),
        ("STAGE 2: PREPROCESSING & CIRCULAR BUFFERING", [
            ("Input", "Raw frames from Stage 1."),
            ("Action (Decoupling)", "Subsampler extracts 1 frame every 200ms (5 FPS target) for AI inference, keeping CPU usage low while preview rendering stays fluid."),
            ("Action (RAM Buffer)", "Every incoming frame is concurrently stored into an in-memory double-ended circular buffer (collections.deque) retaining exactly 3.0 seconds of pre-event history in RAM."),
            ("Output", "Normalized 640x480 RGB image tensors for AI and a rolling 3.0-second pre-event RAM buffer.")
        ]),
        ("STAGE 3: DEEP LEARNING OBJECT DETECTION (YOLOv8n)", [
            ("Input", "Subsampled 640x480 RGB image tensor."),
            ("Action", "Ultralytics YOLOv8n deep neural network performs a forward pass via multi-core PyTorch CPU SIMD/AVX-512 optimization."),
            ("Backbone", "Modified CSPDarknet53 extracts spatial feature pyramids via C2f modules."),
            ("Dual Models", "yolov8n.pt detects people/crowd telemetry; yolov8n_weapon.pt detects handguns, knives, and weapons."),
            ("Post-Processing", "Non-Maximum Suppression (NMS, IoU threshold = 0.45) eliminates duplicate candidate boxes."),
            ("Output", "Candidate bounding box coordinates, class labels, and confidence probability scores [0.0 - 1.0].")
        ]),
        ("STAGE 4: TEMPORAL MULTI-FRAME CONFIRMATION GATE", [
            ("Input", "Candidate detections across consecutive frames."),
            ("Action", "To prevent false alarms caused by momentary shadows, glares, or harmless handheld objects, the temporal weapon tracker checks spatial continuity across time using Euclidean centroid distance matching."),
            ("Trigger Rule", "A threat event is confirmed ONLY if weapon confidence exceeds threshold (>= 0.35) for K >= 2 consecutive frames."),
            ("Output", "Verified Criminal Threat Event Trigger Signal (Transient 1-frame glitches are silently dropped).")
        ]),
        ("STAGE 5: AUTOMATED FORENSIC EVIDENCE GENERATION", [
            ("Input", "Trigger signal from Stage 4."),
            ("Action (Pre-Roll)", "Manager freezes and extracts the 3.0-second circular RAM buffer (the exact footage leading up to the incident)."),
            ("Action (Post-Roll)", "Manager captures ongoing incoming frames for an additional 3.0 seconds post-trigger."),
            ("Action (Encoding)", "The combined 6.0-second frame sequence is encoded into an MP4 video clip (AVC1 codec) in storage/incidents/."),
            ("Action (Thumbnail)", "The frame with the highest confidence is extracted and saved as an annotated high-resolution JPEG thumbnail."),
            ("Output", "Certified 6.0-second MP4 evidence video and JPEG thumbnail with zero pre-event footage loss.")
        ]),
        ("STAGE 6: DATABASE PERSISTENCE & AUDIT LOGGING", [
            ("Input", "Incident metadata, camera identifier, threat type, confidence score, and media file paths."),
            ("Action", "Asynchronous SQLAlchemy session executes an atomic write transaction to SQLite 3 in Write-Ahead Logging (WAL) mode."),
            ("Concurrency", "WAL mode permits concurrent dashboard reads while workers record incidents without table locking."),
            ("Output", "Permanent incident audit record stored in SQLite cctv_surveillance.db.")
        ]),
        ("STAGE 7: REAL-TIME OPERATOR ALERTING & RBAC TRIAGE", [
            ("Input", "Database event and live camera feeds."),
            ("Action", "Web application serves live MJPEG video streams and triggers real-time visual and acoustic alarms."),
            ("Clearance Governance", "Field Operator (View-Only), Threat Analyst (Forensic Triage & Reports), System Administrator (Full System Control)."),
            ("Output", "Real-time command center interface running in React 18 / Vite single-page application.")
        ])
    ]

    for stage_title, details in stages:
        body.append(r"\pard\sa120\sb160\f0\fs24\b\cf2 " + esc(stage_title) + r"\b0\par ")
        for label, text in details:
            body.append(r"\pard\li360\sa80\sl276\slmult1\f0\fs22\cf1\bullet  \b " + esc(label) + r":\b0  " + esc(text) + r"\par ")

    body.append(r"\pard\sa200\sb100\cf7 _________________________________________________________________________________\cf1\par ")

    # 5.2 Layered System Architecture Breakdown
    body.append(r"\pard\sa160\sb140\f0\fs26\b\cf2 5.2 Layered System Architecture Breakdown\b0\par ")
    layers = [
        ("Layer 1: Presentation & User Experience (UI)", "Built with React 18, TypeScript, Tailwind CSS, and Vite. Provides an operator console featuring multi-camera live grid viewing (MJPEG), forensic video batch upload, incident review triage center, weapon detection validation dashboard, and evidence video library."),
        ("Layer 2: API Gateway & Application Server", "Implemented in FastAPI (Python 3.11) running on Uvicorn ASGI server. Exposes high-throughput asynchronous RESTful endpoints and handles non-blocking multipart/x-mixed-replace live MJPEG video streaming directly to client web browsers."),
        ("Layer 3: Computer Vision & AI Inference Engine", "Powered by Ultralytics YOLOv8n running directly on multi-core CPU with SIMD and AVX-512 hardware acceleration. Incorporates dual deep learning models: standard COCO weights and a specialized weapon detection network."),
        ("Layer 4: Stream Ingestion & Multi-Threading Manager", "The CameraStreamManager spawns isolated background daemon threads per CCTV camera endpoint. Each thread interfaces with OpenCV VideoCapture over TCP RTSP, decouples incoming socket ingestion (25 FPS) from neural inference (5 FPS), and maintains an in-memory double-ended circular buffer."),
        ("Layer 5: Temporal Tracking & Evidence Serialization", "The weapon tracker monitors candidate detections across consecutive sampled frames using centroid distance tracking. Upon confirming a persistent threat across K >= 2 frames, it triggers automated packaging of a 6.0-second MP4 evidence video and a peak-confidence JPEG keyframe thumbnail."),
        ("Layer 6: Relational Persistence & Storage Subsystem", "SQLite 3 database configured in asynchronous Write-Ahead Logging (WAL) mode via SQLAlchemy 2.0. WAL mode allows concurrent dashboard readers to query incident logs without encountering database locks during video writes."),
        ("Layer 7: Role-Based Access Control (RBAC) Governance", "A three-tier security access model dividing responsibilities between System Administrator (full clearance), Threat Analyst (incident triage, video analysis, report exports), and Field Operator (real-time camera viewing and read-only alert monitoring).")
    ]

    for l_title, l_desc in layers:
        body.append(r"\pard\li240\sa100\sl276\slmult1\f0\fs22\bullet  \b\cf3 " + esc(l_title) + r":\b0\cf1  " + esc(l_desc) + r"\par ")

    body.append(r"\pard\sa200\sb100\cf7 _________________________________________________________________________________\cf1\par ")

    # 5.3 12-Step Detailed Sequence
    body.append(r"\pard\sa160\sb140\f0\fs26\b\cf2 5.3 Detailed Step-by-Step Data Flow Sequence\b0\par ")
    steps_12 = [
        ("Step 1: Network Stream Connection", "The system establishes an RTSP TCP video connection to the camera (or local webcam/video file)."),
        ("Step 2: Continuous Ring Buffer Ingestion", "Raw frames arrive at 25-30 FPS and are continuously queued into a 3.0-second RAM circular buffer."),
        ("Step 3: Adaptive Frame Subsampling", "Every 200 milliseconds (5 FPS), a frame is dispatched to the YOLOv8n deep learning inference engine."),
        ("Step 4: Image Normalization & Forward Pass", "The frame is resized to 640x480 RGB, normalized to [0.0, 1.0], and evaluated by YOLOv8n to extract bounding boxes and confidence scores."),
        ("Step 5: Non-Maximum Suppression (NMS)", "Overlapping redundant boxes are eliminated using an IoU threshold of 0.45."),
        ("Step 6: Temporal Continuity Validation", "The temporal tracking gate checks if the detected weapon maintains spatial continuity across K consecutive frames (default K = 2). Single-frame false alarms are discarded."),
        ("Step 7: Incident Trigger Activation", "When confirmed, an incident trigger is fired with camera ID, timestamp, and threat class."),
        ("Step 8: Automated Evidence Clip Assembly", "The stream manager extracts the 3.0 seconds of pre-event footage from the RAM ring buffer, appends 3.0 seconds of post-event footage, and writes a 6.0-second MP4 evidence video."),
        ("Step 9: Keyframe Thumbnail Extraction", "The exact frame with peak detection confidence is annotated with bounding boxes and saved as a high-resolution JPEG thumbnail."),
        ("Step 10: Asynchronous Database Commit", "An incident record containing timestamp, camera name, threat category, confidence score, and media paths is committed to SQLite (WAL mode)."),
        ("Step 11: Real-Time Command Center Broadcast", "The web dashboard instantly displays audio-visual threat alerts, updates the unreviewed incident counter, and highlights the affected camera feed."),
        ("Step 12: Role-Based Review & Forensic Triage", "A logged-in Threat Analyst or Administrator reviews the 6-second evidence clip, confirms or dismisses the incident, and exports certified forensic reports.")
    ]

    for num, (s_name, s_desc) in enumerate(steps_12, 1):
        body.append(r"\pard\li360\sa90\sl276\slmult1\f0\fs22\b\cf2 " + str(num) + r". " + esc(s_name) + r":\b0\cf1  " + esc(s_desc) + r"\par ")

    body.append(r"\par}")
    rtf_content = header + "".join(body)

    with open(RTF_OUT_FOLDER, 'w', encoding='ascii', errors='replace') as f:
        f.write(rtf_content)
    with open(RTF_OUT_ROOT, 'w', encoding='ascii', errors='replace') as f:
        f.write(rtf_content)
    print(f"Generated clean RTF: {RTF_OUT_FOLDER}")
    print(f"Generated clean RTF: {RTF_OUT_ROOT}")

if __name__ == "__main__":
    FOLDER.mkdir(parents=True, exist_ok=True)
    create_system_architecture_document()
    create_system_architecture_rtf()
    print("Clean, beautiful, properly structured architecture files compiled successfully!")
