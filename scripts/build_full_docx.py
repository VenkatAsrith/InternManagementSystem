# -*- coding: utf-8 -*-
"""
Builder for TMT Operations Platform Implementation-Ready Documentation DOCX
Generates 'TMT_Operations_Platform_Intern_Implementation_Ready_Documentation_v1.0 (1).docx'
Preserving original fonts, layout, color palette (Navy Blue: #1F4E78 / #17365D),
callout tables (#EAF2F8), code blocks, and all 28 sections.
"""

import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

TEMPLATE_PATH = "TMT_Operations_Platform_Intern_Implementation_Ready_Documentation_v1.0_ORIGINAL.docx"
OUTPUT_PATH = "TMT_Operations_Platform_Intern_Implementation_Ready_Documentation_v1.0 (1).docx"

# Load the original document to inherit all styles, headers, footers, themes, and margins
doc = Document(TEMPLATE_PATH)

# Clear existing paragraphs and tables from document body
body_elements = doc._body._element
for child in list(body_elements):
    # Keep sectPr if present at the end
    if child.tag.endswith('sectPr'):
        continue
    body_elements.remove(child)

# Formatting Helpers
def set_cell_background(cell, fill_hex):
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    cell._tc.get_or_add_tcPr().append(shd)

def set_cell_margins(cell, top=80, bottom=80, start=100, end=100):
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{start}" w:type="dxa"/><w:right w:w="{end}" w:type="dxa"/></w:tcMar>')
    cell._tc.get_or_add_tcPr().append(tcMar)

def set_cell_valign(cell, valign="center"):
    valign_el = parse_xml(f'<w:vAlign {nsdecls("w")} w:val="{valign}"/>')
    cell._tc.get_or_add_tcPr().append(valign_el)

def add_title_block():
    p0 = doc.add_paragraph(style='Normal')
    p0.paragraph_format.space_after = Pt(2)
    r0 = p0.add_run("TECHMECHA TORQUE\nPRIVATE LIMITED")
    r0.bold = True
    r0.font.size = Pt(18)
    r0.font.color.rgb = RGBColor(0x17, 0x36, 0x5D)

    p1 = doc.add_paragraph(style='Normal')
    p1.paragraph_format.space_before = Pt(4)
    p1.paragraph_format.space_after = Pt(2)
    r1 = p1.add_run("TMT OPERATIONS PLATFORM")
    r1.bold = True
    r1.font.size = Pt(26)
    r1.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)

    p2 = doc.add_paragraph(style='Normal')
    p2.paragraph_format.space_after = Pt(2)
    r2 = p2.add_run("Intern Implementation-Ready Documentation")
    r2.bold = True
    r2.font.size = Pt(16)
    r2.font.color.rgb = RGBColor(0x33, 0x33, 0x33)

    p3 = doc.add_paragraph(style='Normal')
    p3.paragraph_format.space_after = Pt(8)
    r3 = p3.add_run("Version 1.1 Enterprise Enhanced  |  17 September 2026")
    r3.font.size = Pt(11)
    r3.font.color.rgb = RGBColor(0x55, 0x55, 0x55)

    p4 = doc.add_paragraph(style='Normal')
    p4.paragraph_format.space_after = Pt(2)
    r4_title = p4.add_run("Purpose\n")
    r4_title.bold = True
    r4_title.font.size = Pt(11)
    r4_title.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)
    r4_body = p4.add_run("Single execution blueprint for interns building TMT's internal operations platform from lead acquisition and corporate ATS recruitment through training, company internship, work execution, asset management, leave workflows, communications, finance, documents, exit offboarding, certificates, reporting, and audit.")
    r4_body.font.size = Pt(10)

    p5 = doc.add_paragraph(style='Normal')
    p5.paragraph_format.space_after = Pt(12)
    r5 = p5.add_run("INTERNAL • IMPLEMENTATION USE")
    r5.bold = True
    r5.font.size = Pt(9)
    r5.font.color.rgb = RGBColor(0x82, 0x82, 0x82)

def add_heading_1(text):
    p = doc.add_paragraph(style='Heading 1')
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(4)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(15)
    r.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)

def add_heading_2(text):
    p = doc.add_paragraph(style='Heading 2')
    p.paragraph_format.space_before = Pt(11)
    p.paragraph_format.space_after = Pt(3)
    r = p.add_run(text)
    r.bold = True
    r.font.size = Pt(12)
    r.font.color.rgb = RGBColor(0x1F, 0x4E, 0x78)

def add_body(text):
    p = doc.add_paragraph(style='Normal')
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text)
    r.font.size = Pt(9.5)

def add_bullet(text):
    p = doc.add_paragraph(style='List Bullet')
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text)
    r.font.size = Pt(9.5)

def add_numbered(text):
    p = doc.add_paragraph(style='List Number')
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.15
    r = p.add_run(text)
    r.font.size = Pt(9.5)

def add_callout(text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    cell = tbl.rows[0].cells[0]
    set_cell_background(cell, "EAF2F8")
    set_cell_margins(cell, top=120, bottom=120, start=160, end=160)
    cell.width = Inches(7.1)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.15
    run = p.add_run(text)
    run.font.size = Pt(9.5)
    run.font.color.rgb = RGBColor(0x17, 0x36, 0x5D)
    doc.add_paragraph().paragraph_format.space_after = Pt(3)

def add_codeblock(text):
    p = doc.add_paragraph(style='CodeBlock')
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.05
    run = p.add_run(text)
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(0x22, 0x22, 0x22)

def add_styled_table(headers, data, col_widths=None):
    tbl = doc.add_table(rows=len(data) + 1, cols=len(headers))
    tbl.style = 'Table Grid'
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    
    # Header row
    h_row = tbl.rows[0]
    for idx, h in enumerate(headers):
        cell = h_row.cells[idx]
        cell.text = str(h)
        set_cell_background(cell, "1F4E78")
        set_cell_margins(cell, top=90, bottom=90, start=110, end=110)
        set_cell_valign(cell, "center")
        if col_widths and idx < len(col_widths):
            cell.width = col_widths[idx]
        for p in cell.paragraphs:
            p.alignment = WD_ALIGN_PARAGRAPH.LEFT
            for r in p.runs:
                r.bold = True
                r.font.color.rgb = RGBColor(255, 255, 255)
                r.font.size = Pt(9.5)
                
    # Data rows
    for r_idx, row_data in enumerate(data):
        row = tbl.rows[r_idx + 1]
        bg = "F4F7FA" if r_idx % 2 == 1 else "FFFFFF"
        for c_idx, val in enumerate(row_data):
            cell = row.cells[c_idx]
            cell.text = str(val)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=70, bottom=70, start=100, end=100)
            set_cell_valign(cell, "top")
            if col_widths and c_idx < len(col_widths):
                cell.width = col_widths[c_idx]
            for p in cell.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(9)
                    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)
    return tbl

print("Initialized DOCX layout engine.")
