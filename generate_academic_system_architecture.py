import os
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

WORKSPACE = Path(r"c:\Users\sadik\Documents\antigravity\adventurous-raman")
FOLDER = WORKSPACE / "Detecting Criminal Activities from CCTV"
IMG_PATH = WORKSPACE / "architecture_diagram.png"

DOCX_OUT_FOLDER = FOLDER / "System_Architecture_WordPad.docx"
RTF_OUT_FOLDER = FOLDER / "System_Architecture_WordPad.rtf"
DOCX_OUT_ROOT = WORKSPACE / "System_Architecture_WordPad.docx"
RTF_OUT_ROOT = WORKSPACE / "System_Architecture_WordPad.rtf"

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def generate_academic_docx():
    doc = docx.Document()

    # Standard Academic Margins: 1.0 inch all around
    for s in doc.sections:
        s.top_margin = Inches(1.0)
        s.bottom_margin = Inches(1.0)
        s.left_margin = Inches(1.0)
        s.right_margin = Inches(1.0)

    # Base Style: Times New Roman 12pt (matches user report)
    normal = doc.styles['Normal']
    normal.font.name = 'Times New Roman'
    normal.font.size = Pt(12)
    normal.font.color.rgb = RGBColor(15, 23, 42)

    # Chapter Header
    ch_p = doc.add_paragraph()
    ch_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    ch_p.paragraph_format.space_before = Pt(0)
    ch_p.paragraph_format.space_after = Pt(2)
    r_ch = ch_p.add_run("CHAPTER 05")
    r_ch.font.name = 'Times New Roman'
    r_ch.font.size = Pt(14)
    r_ch.font.bold = True

    title_p = doc.add_paragraph()
    title_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title_p.paragraph_format.space_after = Pt(18)
    r_t = title_p.add_run("SYSTEM DESIGN")
    r_t.font.name = 'Times New Roman'
    r_t.font.size = Pt(16)
    r_t.font.bold = True

    # 5.1 Architectural Representation
    h1 = doc.add_paragraph()
    h1.paragraph_format.space_before = Pt(12)
    h1.paragraph_format.space_after = Pt(6)
    r1 = h1.add_run("5.1 Architectural Representation")
    r1.font.name = 'Times New Roman'
    r1.font.size = Pt(13)
    r1.font.bold = True

    p_intro = doc.add_paragraph()
    p_intro.paragraph_format.space_after = Pt(12)
    p_intro.paragraph_format.line_spacing = 1.15
    p_intro.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
    r_intro = p_intro.add_run(
        "The system architecture of the project \"Detecting Criminal Activities from CCTV Using Object Detection and "
        "Machine Learning Algorithms\" is structured into seven modular, interconnected layers designed for real-time video "
        "ingestion, deep learning computer vision inference, temporal threat validation, automated evidence generation, and "
        "role-governed human verification. Figure 5.1.1 illustrates the architectural representation and data flow among all "
        "system components."
    )
    r_intro.font.name = 'Times New Roman'
    r_intro.font.size = Pt(12)

    # Insert High-Resolution Architecture Diagram
    if IMG_PATH.exists():
        img_p = doc.add_paragraph()
        img_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        img_p.paragraph_format.space_before = Pt(8)
        img_p.paragraph_format.space_after = Pt(6)
        img_run = img_p.add_run()
        img_run.add_picture(str(IMG_PATH), width=Inches(5.8))

    # Figure Caption
    cap_p = doc.add_paragraph()
    cap_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap_p.paragraph_format.space_after = Pt(20)
    r_cap = cap_p.add_run("Fig 5.1.1 Architectural Representation")
    r_cap.font.name = 'Times New Roman'
    r_cap.font.size = Pt(11)
    r_cap.font.bold = True

    # Page Break for clean academic presentation
    doc.add_page_break()

    # 5.2 Architectural Description
    h2 = doc.add_paragraph()
    h2.paragraph_format.space_before = Pt(12)
    h2.paragraph_format.space_after = Pt(8)
    r2 = h2.add_run("5.2 Architectural Description")
    r2.font.name = 'Times New Roman'
    r2.font.size = Pt(13)
    r2.font.bold = True

    sections_text = [
        ("General Architectural Overview",
         "The architecture of the \"Detecting Criminal Activities from CCTV\" project consists of several connected components "
         "that work together seamlessly to capture, process, and analyze video footage in real-time. The core philosophy of this "
         "architecture is to decouple high-frequency frame ingestion from neural network inference, allowing smooth 25–30 FPS live "
         "surveillance monitoring while executing deep convolutional neural network inferences at an adaptive, resource-efficient "
         "rate on standard multi-core CPU hardware without requiring dedicated enterprise GPU clusters."),

        ("1. Input Layer",
         "The Input Layer serves as the entry gateway for all live and recorded visual data. It abstracts disparate video sources, "
         "including commercial CCTV IP cameras streaming over network protocols (RTSP/HTTP), local integrated webcams, external USB "
         "video capture cards, and pre-recorded surveillance video files (MP4, AVI, MKV) uploaded for forensic batch investigation. "
         "The ingestion layer employs standardized communication protocols, enforcing TCP packet transport for network streams to "
         "eliminate UDP packet fragmentation and visual frame tearing."),

        ("2. Video Processing Layer",
         "The Video Processing Layer operates as a multi-threaded frame acquisition and normalization engine powered by OpenCV "
         "(cv2.VideoCapture). Dedicated background daemon worker threads interface directly with each video stream, continually "
         "extracting raw video frames at native clock frequencies. This layer implements input validation, frame resizing to a "
         "standard 640x480 resolution, and color-space conversion from OpenCV BGR to RGB format. Concurrently, an in-memory "
         "circular double-ended buffer (collections.deque) maintains a rolling 3.0-second cache of historical frames, ensuring "
         "zero-loss pre-incident video evidence preservation."),

        ("3. AI Detection Layer",
         "The AI Detection Layer houses the core machine learning inference engine utilizing the state-of-the-art Ultralytics "
         "YOLOv8n (You Only Look Once version 8 nano) deep learning network. Optimized specifically for multi-core CPU inference via "
         "vectorized SIMD and AVX instruction sets, this layer performs real-time feature extraction using Cross-Stage Partial (C2f) "
         "modules and Spatial Pyramid Pooling Fast (SPPF). The layer operates specialized models: a general detection model for person "
         "and crowd spatial tracking, and a custom-trained weapon detection model targeting handguns, rifles, and bladed weapons. "
         "Output detections include bounding box spatial coordinates, class identity labels, and softmax confidence scores. "
         "Non-Maximum Suppression (NMS) with an IoU threshold of 0.45 filters redundant candidate boxes."),

        ("4. Backend Application Layer",
         "The Backend Application Layer is constructed upon the asynchronous FastAPI Python framework running on an ASGI Uvicorn "
         "server. It orchestrates system services, request routing, background task workers, and client communications. This layer "
         "dispatches video frames from the stream manager to the AI detection engine, manages multi-part live MJPEG video broadcast "
         "streams directly to web clients, and coordinates the temporal multi-frame confirmation gate that validates candidate threats "
         "across consecutive video frames to prevent false alarms caused by fleeting shadows or handheld items."),

        ("5. Incident Management Subsystem",
         "The Incident Management Subsystem automatically triggers upon confirmation of a criminal anomaly. Once a threat candidate "
         "exceeds the validation threshold across consecutive frames (K >= 2), this subsystem captures the incident metadata, "
         "extracts the 3.0-second pre-event footage from the RAM circular buffer, appends 3.0 seconds of post-event footage, and encodes "
         "a complete 6.0-second MP4 evidence video. Additionally, it isolates the exact keyframe displaying peak detection confidence, "
         "overlays localized bounding boxes, and generates a high-definition JPEG thumbnail for rapid triage."),

        ("6. Data Storage Subsystem",
         "The Data Storage Subsystem guarantees ACID-compliant persistence and high-concurrency access via SQLite 3 operating in "
         "asynchronous Write-Ahead Logging (WAL) mode. Managed through SQLAlchemy 2.0 object-relational mapping, WAL mode decouples "
         "database readers from writers, ensuring that multiple dashboard operators can simultaneously query incident logs, camera "
         "status records, and audit ledgers while video processing threads write new incident entries with sub-millisecond latency. "
         "Physical media files are organized into structured directories for evidence clips (/storage/incidents/) and model weights."),

        ("7. Presentation Layer",
         "The Presentation Layer provides a modern, responsive Single-Page Application (SPA) developed with React 18, TypeScript, "
         "Tailwind CSS, and Vite. It furnishes security personnel with an integrated command dashboard featuring a live multi-camera "
         "CCTV monitoring grid, a forensic video batch analysis queue, an incident review and triage center, a weapon detection "
         "validation suite, and an evidence video playback library. The presentation layer connects to the backend through asynchronous "
         "REST APIs and high-efficiency MJPEG stream endpoints."),

        ("8. Human Review & Role-Based Access Control (RBAC)",
         "The Human Review component represents the final supervisory governance tier, ensuring that AI-detected anomalies are "
         "reviewed by qualified personnel before law enforcement escalation. The system enforces strict Role-Based Access Control (RBAC): "
         "Field Operators possess read-only clearance to monitor live feeds; Threat Analysts possess forensic clearance to acknowledge, "
         "review, and dismiss incident alerts and export certified reports; while System Administrators retain full authority to "
         "configure camera endpoints, tune AI confidence thresholds, and manage operator clearances.")
    ]

    for title, para in sections_text:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.15
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY

        r_heading = p.add_run(title + "\n")
        r_heading.font.name = 'Times New Roman'
        r_heading.font.size = Pt(12)
        r_heading.font.bold = True
        r_heading.font.color.rgb = RGBColor(30, 58, 138)

        r_body = p.add_run(para)
        r_body.font.name = 'Times New Roman'
        r_body.font.size = Pt(12)
        r_body.font.color.rgb = RGBColor(30, 41, 59)

    # Summary Architecture Component Matrix Table
    p_tbl_title = doc.add_paragraph()
    p_tbl_title.paragraph_format.space_before = Pt(14)
    p_tbl_title.paragraph_format.space_after = Pt(6)
    r_tt = p_tbl_title.add_run("Table 5.1 System Architecture Component and Technology Summary")
    r_tt.font.name = 'Times New Roman'
    r_tt.font.size = Pt(11)
    r_tt.font.bold = True

    comp_rows = [
        ("Input Layer", "RTSP, TCP, Webcams, MP4 Files", "Captures raw video feeds from multiple camera endpoints at 25-30 FPS."),
        ("Video Processing Layer", "OpenCV (cv2.VideoCapture)", "Decouples frame capture from AI, resizes to 640x480, buffers 3s in RAM."),
        ("AI Detection Layer", "YOLOv8n, PyTorch CPU Engine", "Executes real-time object detection for persons, weapons, and anomaly bounding boxes."),
        ("Backend Layer", "FastAPI, Uvicorn ASGI Server", "Manages asynchronous REST APIs, route handling, and multipart MJPEG stream broadcast."),
        ("Incident Management", "Temporal Multi-Frame Gate", "Confirms threats over consecutive frames, packages 6s MP4 clips and JPEG thumbnails."),
        ("Data Storage", "SQLite 3 (WAL Mode), SQLAlchemy", "Maintains relational schema for cameras, incidents, and audit logs with non-blocking reads."),
        ("Presentation Layer", "React 18, TypeScript, Tailwind", "Renders responsive operator command console, multi-view feeds, and triage center."),
        ("Human Review / RBAC", "Clearance Governance Engine", "Provides 3-tier access control (Admin, Analyst, Operator) for verified human oversight.")
    ]

    tbl = doc.add_table(rows=len(comp_rows) + 1, cols=3)
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER

    hdr = tbl.rows[0]
    hdr.cells[0].text = "Architecture Layer"
    hdr.cells[1].text = "Core Technology"
    hdr.cells[2].text = "Functional Role"

    for c in hdr.cells:
        set_cell_background(c, "1E3A8A")
        for p in c.paragraphs:
            for r in p.runs:
                r.font.name = 'Times New Roman'
                r.font.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(10)

    hdr.cells[0].width = Inches(1.8)
    hdr.cells[1].width = Inches(2.2)
    hdr.cells[2].width = Inches(2.8)

    for idx, (l_name, l_tech, l_role) in enumerate(comp_rows):
        row = tbl.rows[idx + 1]
        row.cells[0].width = Inches(1.8)
        row.cells[1].width = Inches(2.2)
        row.cells[2].width = Inches(2.8)

        row.cells[0].text = l_name
        row.cells[1].text = l_tech
        row.cells[2].text = l_role

        bg = "F8FAFC" if (idx % 2 == 1) else "FFFFFF"
        for c in row.cells:
            set_cell_background(c, bg)
            p = c.paragraphs[0]
            for r in p.runs:
                r.font.name = 'Times New Roman'
                r.font.size = Pt(9.5)
                r.font.color.rgb = RGBColor(30, 41, 59)

    doc.save(str(DOCX_OUT_FOLDER))
    doc.save(str(DOCX_OUT_ROOT))
    print(f"Generated Academic DOCX: {DOCX_OUT_FOLDER}")
    print(f"Generated Academic DOCX: {DOCX_OUT_ROOT}")

def generate_academic_rtf():
    # WordPad RTF format with clean boxes and Times New Roman
    header = (
        r"{\rtf1\ansi\ansicpg1252\deff0\nouicompat\deflang1033"
        r"{\fonttbl{\f0\froman\fcharset0 Times New Roman;}{\f1\fnil\fcharset0 Consolas;}}"
        r"{\colortbl ;\red15\green23\blue42;\red30\green58\blue138;\red14\green116\blue144;\red71\green85\blue105;\red203\green213\blue225;}"
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
    body.append(r"\pard\qc\sa120\sb100\f0\fs28\b\cf1 CHAPTER 05\par SYSTEM DESIGN\b0\par ")
    body.append(r"\pard\sa160\cf5 _________________________________________________________________________________\cf1\par ")

    body.append(r"\pard\sa140\sb140\f0\fs24\b\cf2 5.1 Architectural Representation\b0\par ")
    body.append(r"\pard\sa160\sl276\slmult1\f0\fs22\cf1 The system architecture of the project \"Detecting Criminal Activities from CCTV Using Object Detection and Machine Learning Algorithms\" is structured into seven modular, interconnected layers designed for real-time video ingestion, deep learning computer vision inference, temporal threat validation, automated evidence generation, and role-governed human verification.\par ")

    # Perfectly-aligned ASCII Architecture Box in Monospace Consolas for WordPad
    diagram_ascii = [
        "+-------------------------------------------------------------------------+",
        "|                              INPUT LAYER                                |",
        "|  +--------------------+--------------------+-------------------------+  |",
        "|  | CCTV / IP Camera   | Webcam / USB       | Uploaded Video          |  |",
        "|  | Stream             | Camera             | Files (MP4/AVI)         |  |",
        "|  +--------------------+--------------------+-------------------------+  |",
        "+------------------------------------+------------------------------------+",
        "                                     |",
        "                                     v",
        "+-------------------------------------------------------------------------+",
        "|                         VIDEO PROCESSING LAYER                          |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | OpenCV Video Capture and Frame Extraction                         |  |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Frame Preparation, Validation & 3.0-Second RAM Ring Buffer        |  |",
        "|  +-------------------------------------------------------------------+  |",
        "+------------------------------------+------------------------------------+",
        "                                     |",
        "                                     v",
        "+-------------------------------------------------------------------------+",
        "|                           AI DETECTION LAYER                            |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Configured YOLO Detection Model (YOLOv8n CPU Engine)              |  |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Person Detection  |  Supported Weapon Detection                   |  |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Bounding Boxes  |  Class Labels  |  Confidence Scores             |  |",
        "|  +-------------------------------------------------------------------+  |",
        "+------------------------------------+------------------------------------+",
        "                                     |",
        "                                     v",
        "+-------------------------------------------------------------------------+",
        "|                        BACKEND APPLICATION LAYER                        |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | FastAPI Backend Framework (Asynchronous ASGI Uvicorn Server)      |  |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Request Handling  |  Result Processing  |  API Communication      |  |",
        "|  +-------------------------------------------------------------------+  |",
        "+------------------+-----------------------------------+------------------+",
        "                   |                                   |",
        "                   v                                   v",
        "+------------------------------------+   +--------------------------------+",
        "|        INCIDENT MANAGEMENT         |   |          DATA STORAGE          |",
        "|  - Organize Detection Results      |   |  - SQLite Database (WAL Mode)  |",
        "|  - Review Available Threat Alerts  |   |  - SQLAlchemy Database Access  |",
        "+------------------+-----------------+   +-----------------+--------------+",
        "                   |                                       |",
        "                   +-------------------+-------------------+",
        "                                       |",
        "                                       v",
        "+-------------------------------------------------------------------------+",
        "|                           PRESENTATION LAYER                            |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | React Web Interface (Single-Page Application in TypeScript)       |  |",
        "|  +-------------------------------------------------------------------+  |",
        "|  | Video Display  |  Detection Results  |  Incident Information      |  |",
        "|  +-------------------------------------------------------------------+  |",
        "+------------------------------------+------------------------------------+",
        "                                     |",
        "                                     v",
        "+-------------------------------------------------------------------------+",
        "|                              HUMAN REVIEW                               |",
        "|  Authorized User Reviews Potential Detection Alerts and Determines      |",
        "|  Whether Further Law Enforcement Investigation Is Needed (RBAC Gated)   |",
        "+-------------------------------------------------------------------------+",
        "                 Fig 5.1.1 Architectural Representation"
    ]

    body.append(r"\pard\li240\ri240\f1\fs16\cf1 ")
    for d_line in diagram_ascii:
        body.append(esc(d_line) + r"\par ")

    body.append(r"\pard\sa160\sb160\cf5 _________________________________________________________________________________\cf1\par ")

    # 5.2 Architectural Description
    body.append(r"\pard\sa140\sb140\f0\fs24\b\cf2 5.2 Architectural Description\b0\par ")
    
    desc_paragraphs = [
        "The architecture of the \"Detecting Criminal Activities from CCTV\" project consists of several connected components that work together to analyze video footage and display detection results. The main components include the video input module, video-processing module, AI-based object detection module, backend services, web user interface, and data storage. Each component performs a specific function, allowing the application to process video and organize potential threat alerts efficiently.",
        "1. Input Layer: Handles diverse video input feeds including live CCTV IP camera streams (over RTSP/TCP), USB webcams, and pre-recorded surveillance video recordings uploaded by forensic analysts for batch processing.",
        "2. Video Processing Layer: Powered by OpenCV (cv2.VideoCapture), this layer extracts video frames, validates input integrity, normalizes dimensions to 640x480 RGB, and maintains a rolling 3.0-second circular buffer in memory for zero-loss pre-incident evidence recording.",
        "3. AI Detection Layer: Implements the Ultralytics YOLOv8n deep learning network optimized for multi-core CPU execution. Employs dual model weights for person tracking and weapon detection (handguns, knives), producing normalized bounding boxes, class labels, and confidence probabilities.",
        "4. Backend Application Layer: Built using FastAPI and Uvicorn, handling asynchronous HTTP REST requests, client API communications, and real-time multipart/x-mixed-replace MJPEG video streaming directly to client web browsers.",
        "5. Incident Management: The temporal confirmation gate evaluates detections across time, firing an incident trigger only when a threat persists across consecutive frames (K >= 2). It automatically packages a 6-second MP4 evidence clip (3s pre-event + 3s post-event) and a peak-confidence JPEG thumbnail.",
        "6. Data Storage: An asynchronous SQLite 3 database operating in Write-Ahead Logging (WAL) mode via SQLAlchemy 2.0. WAL mode allows concurrent readers to access incident logs and camera records while workers write new evidence with zero database locking.",
        "7. Presentation Layer: A responsive single-page web console constructed in React 18, TypeScript, and Tailwind CSS. Furnishes live CCTV grid monitoring, forensic upload queues, incident review triage, and evidence playback.",
        "8. Human Review: Serves as the supervisory governance layer enforcing Role-Based Access Control (RBAC). Field Operators have monitoring clearance; Threat Analysts review, acknowledge, and triage alerts; while Lead Administrators configure hardware and AI detection thresholds."
    ]

    for p_text in desc_paragraphs:
        body.append(r"\pard\sa140\sl276\slmult1\f0\fs22\cf1 " + esc(p_text) + r"\par ")

    body.append(r"\par}")
    rtf_content = header + "".join(body)

    with open(RTF_OUT_FOLDER, 'w', encoding='ascii', errors='replace') as f:
        f.write(rtf_content)
    with open(RTF_OUT_ROOT, 'w', encoding='ascii', errors='replace') as f:
        f.write(rtf_content)
    print(f"Generated Academic RTF: {RTF_OUT_FOLDER}")
    print(f"Generated Academic RTF: {RTF_OUT_ROOT}")

if __name__ == '__main__':
    FOLDER.mkdir(parents=True, exist_ok=True)
    import shutil
    shutil.copy(IMG_PATH, FOLDER / "architecture_diagram.png")
    generate_academic_docx()
    generate_academic_rtf()
    print("All perfect architecture files generated successfully!")
