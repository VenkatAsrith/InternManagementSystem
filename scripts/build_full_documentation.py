# -*- coding: utf-8 -*-
"""
Builder for TMT Operations Platform Master Documentation (Markdown + DOCX)
Version 1.1 Enterprise Enhanced
"""

import os
import sys
import docx
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls

MD_PATH = os.path.join("docs", "TMT_OPERATIONS_PLATFORM_V1.1_MASTER.md")
DOCX_TEMPLATE = "TMT_Operations_Platform_Intern_Implementation_Ready_Documentation_v1.0_ORIGINAL.docx"
DOCX_PATH = "TMT_Operations_Platform_Intern_Implementation_Ready_Documentation_v1.0 (1).docx"

print("Starting generation...")
