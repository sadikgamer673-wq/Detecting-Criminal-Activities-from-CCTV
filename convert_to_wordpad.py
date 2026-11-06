import os
import re
from pathlib import Path
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

ARTIFACT_PATH = Path(r"C:\Users\sadik\.gemini\antigravity\brain\dd15d5b0-d0f3-4f99-a95f-489089d45515\cctv_ai_surveillance_comprehensive_project_report.md")
WORKSPACE_DIR = Path(r"c:\Users\sadik\Documents\antigravity\adventurous-raman")

SEPARATE_DIR = WORKSPACE_DIR / "Detecting Criminal Activities from CCTV"

OUTPUT_FILES = [
    # Dedicated Separate Folder
    {
        "docx": SEPARATE_DIR / "Detecting Criminal Activities from CCTV.docx",
        "rtf": SEPARATE_DIR / "Detecting Criminal Activities from CCTV.rtf",
        "md": SEPARATE_DIR / "Detecting Criminal Activities from CCTV.md",
    },
    # Root Workspace Files
    {
        "docx": WORKSPACE_DIR / "Detecting Criminal Activities from CCTV.docx",
        "rtf": WORKSPACE_DIR / "Detecting Criminal Activities from CCTV.rtf",
        "md": WORKSPACE_DIR / "Detecting Criminal Activities from CCTV.md",
    }
]

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def convert_to_docx(md_text, docx_path):
    doc = docx.Document()

    # Page Margins: 1 inch on all sides
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)

    # Base Normal Style
    normal_style = doc.styles['Normal']
    normal_style.font.name = 'Calibri'
    normal_style.font.size = Pt(11)
    normal_style.font.color.rgb = RGBColor(30, 41, 59) # Slate 800

    lines = md_text.splitlines()
    in_code_block = False
    code_block_lines = []
    in_table = False
    table_lines = []

    def flush_table(tbl_lines):
        if not tbl_lines:
            return
        parsed_rows = []
        for row_str in tbl_lines:
            # skip separator lines like |:---|:---|
            if re.match(r'^\s*\|?\s*:?-+:?\s*\|', row_str):
                continue
            cols = [c.strip() for c in row_str.strip().strip('|').split('|')]
            if any(cols):
                parsed_rows.append(cols)

        if not parsed_rows:
            return

        col_count = max(len(r) for r in parsed_rows)
        # normalize
        for r in parsed_rows:
            while len(r) < col_count:
                r.append("")

        table = doc.add_table(rows=len(parsed_rows), cols=col_count)
        table.style = 'Table Grid'
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = True

        for r_idx, row_data in enumerate(parsed_rows):
            is_header = (r_idx == 0)
            row = table.rows[r_idx]
            for c_idx, val in enumerate(row_data):
                cell = row.cells[c_idx]
                p = cell.paragraphs[0]
                p.paragraph_format.space_before = Pt(3)
                p.paragraph_format.space_after = Pt(3)
                p.paragraph_format.line_spacing = 1.15
                
                # clean formatting
                clean_val = re.sub(r'\*\*(.*?)\*\*', r'\1', val)
                clean_val = re.sub(r'\*(.*?)\*', r'\1', clean_val)
                clean_val = re.sub(r'`(.*?)`', r'\1', clean_val)

                run = p.add_run(clean_val)
                run.font.name = 'Calibri'
                
                if is_header:
                    set_cell_background(cell, "1E293B") # Dark slate
                    run.bold = True
                    run.font.size = Pt(10)
                    run.font.color.rgb = RGBColor(255, 255, 255)
                else:
                    if r_idx % 2 == 1:
                        set_cell_background(cell, "F8FAFC") # light slate
                    else:
                        set_cell_background(cell, "FFFFFF")
                    run.font.size = Pt(9.5)
                    run.font.color.rgb = RGBColor(30, 41, 59)

        doc.add_paragraph().paragraph_format.space_after = Pt(6)

    def add_styled_paragraph(text, bullet=False):
        p = doc.add_paragraph()
        p.paragraph_format.line_spacing = 1.25
        p.paragraph_format.space_after = Pt(7)
        if bullet:
            p.paragraph_format.left_indent = Inches(0.25)
            run_bullet = p.add_run("•  ")
            run_bullet.bold = True
            run_bullet.font.color.rgb = RGBColor(59, 130, 246) # Blue

        # Parse inline markdown (bold, italic, code)
        tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', text)
        for token in tokens:
            if not token:
                continue
            if token.startswith('**') and token.endswith('**'):
                run = p.add_run(token[2:-2])
                run.bold = True
                run.font.color.rgb = RGBColor(15, 23, 42)
            elif token.startswith('*') and token.endswith('*'):
                run = p.add_run(token[1:-1])
                run.italic = True
            elif token.startswith('`') and token.endswith('`'):
                run = p.add_run(token[1:-1])
                run.font.name = 'Consolas'
                run.font.size = Pt(9.5)
                run.font.color.rgb = RGBColor(30, 58, 138) # Dark blue
            else:
                p.add_run(token)

    i = 0
    while i < len(lines):
        line = lines[i]

        # Handle Code blocks
        if line.startswith('```'):
            if in_code_block:
                # end of code block
                in_code_block = False
                p = doc.add_paragraph()
                p.paragraph_format.left_indent = Inches(0.3)
                p.paragraph_format.space_before = Pt(4)
                p.paragraph_format.space_after = Pt(8)
                run = p.add_run("\n".join(code_block_lines))
                run.font.name = 'Consolas'
                run.font.size = Pt(9)
                run.font.color.rgb = RGBColor(30, 41, 59)
                code_block_lines = []
            else:
                in_code_block = True
                code_block_lines = []
            i += 1
            continue

        if in_code_block:
            code_block_lines.append(line)
            i += 1
            continue

        # Handle Tables
        if '|' in line and ('--' in line or (i + 1 < len(lines) and '|' in lines[i+1] and '--' in lines[i+1]) or in_table):
            in_table = True
            table_lines.append(line)
            i += 1
            continue
        elif in_table:
            in_table = False
            flush_table(table_lines)
            table_lines = []

        # Handle Headings
        if line.startswith('# '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(18)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(line[2:].strip())
            run.bold = True
            run.font.size = Pt(20)
            run.font.color.rgb = RGBColor(15, 23, 42) # Slate 900
        elif line.startswith('## '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(16)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run(line[3:].strip())
            run.bold = True
            run.font.size = Pt(15)
            run.font.color.rgb = RGBColor(30, 58, 138) # Deep Blue
        elif line.startswith('### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(12)
            p.paragraph_format.space_after = Pt(4)
            run = p.add_run(line[4:].strip())
            run.bold = True
            run.font.size = Pt(12.5)
            run.font.color.rgb = RGBColor(3, 105, 161) # Cyan/Blue
        elif line.startswith('#### '):
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(8)
            p.paragraph_format.space_after = Pt(3)
            run = p.add_run(line[5:].strip())
            run.bold = True
            run.font.size = Pt(11)
            run.font.color.rgb = RGBColor(51, 65, 85)
        elif line.startswith('- ') or line.startswith('* '):
            add_styled_paragraph(line[2:].strip(), bullet=True)
        elif re.match(r'^\d+\.\s+', line):
            m = re.match(r'^(\d+\.)\s+(.*)', line)
            p = doc.add_paragraph()
            p.paragraph_format.line_spacing = 1.25
            p.paragraph_format.space_after = Pt(6)
            p.paragraph_format.left_indent = Inches(0.25)
            num_run = p.add_run(f"{m.group(1)}  ")
            num_run.bold = True
            num_run.font.color.rgb = RGBColor(30, 58, 138)
            # inline parse rest
            tokens = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', m.group(2))
            for token in tokens:
                if not token:
                    continue
                if token.startswith('**') and token.endswith('**'):
                    run = p.add_run(token[2:-2])
                    run.bold = True
                elif token.startswith('`') and token.endswith('`'):
                    run = p.add_run(token[1:-1])
                    run.font.name = 'Consolas'
                    run.font.size = Pt(9.5)
                else:
                    p.add_run(token)
        elif line.strip() == '---':
            # divider line
            p = doc.add_paragraph()
            p.paragraph_format.space_before = Pt(6)
            p.paragraph_format.space_after = Pt(6)
            run = p.add_run("―" * 50)
            run.font.color.rgb = RGBColor(203, 213, 225)
        elif line.strip():
            add_styled_paragraph(line.strip())

        i += 1

    if in_table and table_lines:
        flush_table(table_lines)

    doc.save(docx_path)
    print(f"Successfully generated DOCX at: {docx_path}")

def convert_to_rtf(md_text, rtf_path):
    # RTF Generator (WordPad native format)
    header = (
        r"{\rtf1\ansi\ansicpg1252\deff0\nouicompat\deflang1033"
        r"{\fonttbl{\f0\fnil\fcharset0 Calibri;}{\f1\fnil\fcharset0 Consolas;}{\f2\fnil\fcharset0 Arial;}}"
        r"{\colortbl ;\red15\green23\blue42;\red30\green58\blue138;\red3\green105\blue161;\red51\green65\blue85;\red59\green130\blue246;\red241\green245\blue249;}"
        r"\viewkind4\uc1 \pard\sa200\sl276\slmult1\f0\fs22\cf1 "
    )

    lines = md_text.splitlines()
    body_parts = []

    def escape_rtf(text):
        text = text.replace('\\', '\\\\')
        text = text.replace('{', '\\{')
        text = text.replace('}', '\\}')
        # handle special unicode
        out = []
        for char in text:
            code = ord(char)
            if code > 127:
                out.append(f"\\u{code}?")
            else:
                out.append(char)
        return "".join(out)

    def format_rtf_line(text):
        # Escape raw text first
        # Format bold **text**
        parts = re.split(r'(\*\*.*?\*\*|\*.*?\*|`.*?`)', text)
        res = ""
        for part in parts:
            if not part:
                continue
            if part.startswith('**') and part.endswith('**'):
                res += r"\b " + escape_rtf(part[2:-2]) + r"\b0 "
            elif part.startswith('*') and part.endswith('*'):
                res += r"\i " + escape_rtf(part[1:-1]) + r"\i0 "
            elif part.startswith('`') and part.endswith('`'):
                res += r"\f1\fs19\cf2 " + escape_rtf(part[1:-1]) + r"\f0\fs22\cf1 "
            else:
                res += escape_rtf(part)
        return res

    in_code = False

    for line in lines:
        if line.startswith('```'):
            in_code = not in_code
            if in_code:
                body_parts.append(r"\pard\li360\ri360\f1\fs18\cf2\sa100 ")
            else:
                body_parts.append(r"\pard\sa200\sl276\slmult1\f0\fs22\cf1 ")
            continue

        if in_code:
            body_parts.append(escape_rtf(line) + r"\par ")
            continue

        if line.startswith('# '):
            body_parts.append(r"\pard\sa300\sb200\f0\fs36\b\cf1 " + escape_rtf(line[2:].strip()) + r"\b0\par\sa200\fs22\cf1 ")
        elif line.startswith('## '):
            body_parts.append(r"\pard\sa240\sb180\f0\fs28\b\cf2 " + escape_rtf(line[3:].strip()) + r"\b0\par\sa200\fs22\cf1 ")
        elif line.startswith('### '):
            body_parts.append(r"\pard\sa200\sb140\f0\fs24\b\cf3 " + escape_rtf(line[4:].strip()) + r"\b0\par\sa200\fs22\cf1 ")
        elif line.startswith('#### '):
            body_parts.append(r"\pard\sa160\sb100\f0\fs22\b\cf4 " + escape_rtf(line[5:].strip()) + r"\b0\par\sa200\fs22\cf1 ")
        elif line.startswith('- ') or line.startswith('* '):
            body_parts.append(r"\pard\li360\sa120\bullet  " + format_rtf_line(line[2:].strip()) + r"\par\pard\sa200 ")
        elif re.match(r'^\d+\.\s+', line):
            m = re.match(r'^(\d+\.)\s+(.*)', line)
            body_parts.append(r"\pard\li360\sa120\b " + escape_rtf(m.group(1)) + r"\b0  " + format_rtf_line(m.group(2)) + r"\par\pard\sa200 ")
        elif line.strip() == '---':
            body_parts.append(r"\pard\sa160\sb160\cf4 _____________________________________________________________________\cf1\par\sa200 ")
        elif line.strip():
            body_parts.append(r"\pard\sa200\sl276\slmult1 " + format_rtf_line(line.strip()) + r"\par ")

    footer = r"\par}"
    rtf_content = header + "".join(body_parts) + footer

    with open(rtf_path, 'w', encoding='ascii', errors='replace') as f:
        f.write(rtf_content)

    print(f"Successfully generated RTF (WordPad format) at: {rtf_path}")

if __name__ == "__main__":
    import shutil
    SEPARATE_DIR.mkdir(parents=True, exist_ok=True)

    with open(ARTIFACT_PATH, 'r', encoding='utf-8') as f:
        md_text = f.read()

    for item in OUTPUT_FILES:
        item["docx"].parent.mkdir(parents=True, exist_ok=True)
        convert_to_docx(md_text, item["docx"])
        convert_to_rtf(md_text, item["rtf"])
        with open(item["md"], 'w', encoding='utf-8') as f:
            f.write(md_text)
        print(f"Generated: {item['docx']}")
        print(f"Generated: {item['rtf']}")
        print(f"Generated: {item['md']}")
