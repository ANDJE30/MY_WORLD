"""Petite bibliothèque de mise en forme Word (python-docx) aux couleurs d'EduGest CM."""
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.section import WD_ORIENT, WD_SECTION
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from PIL import Image
import os

GREEN = RGBColor(0x0B, 0x5D, 0x4B)
GOLD = RGBColor(0xA9, 0x7A, 0x1D)
DARK = RGBColor(0x1F, 0x29, 0x37)
MUTED = RGBColor(0x6B, 0x72, 0x80)
FONT = 'Calibri'


def _shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), hex_fill)
    tcPr.append(shd)


def _cell_margins(table, top=60, bottom=60, left=90, right=90):
    tblPr = table._tbl.tblPr
    mar = OxmlElement('w:tblCellMar')
    for k, v in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        el = OxmlElement(f'w:{k}'); el.set(qn('w:w'), str(v)); el.set(qn('w:type'), 'dxa'); mar.append(el)
    tblPr.append(mar)


def _borders(table, color='CBD5D1', size=4):
    tblPr = table._tbl.tblPr
    b = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{edge}'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), str(size)); el.set(qn('w:color'), color)
        b.append(el)
    tblPr.append(b)


def _set_widths(table, widths_cm):
    table.autofit = False
    tblPr = table._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
    tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(widths_cm) * 567))); tw.set(qn('w:type'), 'dxa')
    for old in tblPr.findall(qn('w:tblW')): tblPr.remove(old)
    tblPr.append(tw)
    for i, w in enumerate(widths_cm):
        table.columns[i].width = Cm(w)
        for row in table.rows: row.cells[i].width = Cm(w)


def _field(paragraph, instr, placeholder=''):
    run = paragraph.add_run()
    b = OxmlElement('w:fldChar'); b.set(qn('w:fldCharType'), 'begin')
    i = OxmlElement('w:instrText'); i.set(qn('xml:space'), 'preserve'); i.text = instr
    s = OxmlElement('w:fldChar'); s.set(qn('w:fldCharType'), 'separate')
    t = OxmlElement('w:t'); t.text = placeholder
    e = OxmlElement('w:fldChar'); e.set(qn('w:fldCharType'), 'end')
    for x in (b, i, s, t, e): run._r.append(x)
    return run


class Doc:
    def __init__(self, title, short):
        self.d = Document()
        self.title, self.short = title, short
        self.fig = 0
        self.tab = 0
        sec = self.d.sections[0]
        sec.page_width, sec.page_height = Cm(21), Cm(29.7)
        sec.left_margin = sec.right_margin = Cm(2.2)
        sec.top_margin, sec.bottom_margin = Cm(2.2), Cm(2.0)
        st = self.d.styles
        n = st['Normal']; n.font.name = FONT; n.font.size = Pt(10.5); n.font.color.rgb = DARK
        n.element.rPr.rFonts.set(qn('w:eastAsia'), FONT)
        n.paragraph_format.space_after = Pt(5); n.paragraph_format.line_spacing = 1.12
        for lvl, size, color, before in ((1, 17, GREEN, 18), (2, 13.5, GREEN, 12), (3, 11.5, GOLD, 9)):
            h = st[f'Heading {lvl}']
            h.font.name = FONT; h.font.size = Pt(size); h.font.bold = True; h.font.color.rgb = color
            h.element.rPr.rFonts.set(qn('w:eastAsia'), FONT); h.element.rPr.rFonts.set(qn('w:ascii'), FONT); h.element.rPr.rFonts.set(qn('w:hAnsi'), FONT)
            h.paragraph_format.space_before = Pt(before); h.paragraph_format.space_after = Pt(6); h.paragraph_format.keep_with_next = True
        for name in ('List Bullet', 'List Number'):
            st[name].font.name = FONT; st[name].font.size = Pt(10.5)
        cap = st['Caption']; cap.font.name = FONT; cap.font.size = Pt(9); cap.font.italic = True; cap.font.color.rgb = MUTED; cap.font.bold = False
        self._footer()

    def _footer(self):
        sec = self.d.sections[0]
        hp = sec.header.paragraphs[0]; hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        r = hp.add_run(f'EduGest CM  •  {self.short}'); r.font.size = Pt(8.5); r.font.color.rgb = MUTED
        fp = sec.footer.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
        for txt, instr in (('Page ', 'PAGE'), (' / ', 'NUMPAGES')):
            rr = fp.add_run(txt); rr.font.size = Pt(8.5); rr.font.color.rgb = MUTED
            f = _field(fp, instr, '1'); f.font.size = Pt(8.5); f.font.color.rgb = MUTED
        sec.different_first_page_header_footer = True

    # ---------- page de garde ----------
    def cover(self, kicker, title, subtitle, meta, logo=None):
        d = self.d
        p = d.add_paragraph(); p.paragraph_format.space_before = Pt(10)
        if logo and os.path.exists(logo):
            p.add_run().add_picture(logo, width=Cm(2.6))
        band = d.add_table(rows=1, cols=1); band.alignment = WD_TABLE_ALIGNMENT.CENTER
        c = band.cell(0, 0); _shade(c, '0B5D4B'); _cell_margins(band, 300, 300, 400, 400); _set_widths(band, [16.6])
        c.paragraphs[0].text = ''
        r = c.paragraphs[0].add_run(kicker.upper()); r.font.size = Pt(10); r.font.bold = True; r.font.color.rgb = RGBColor(0xE7, 0xC7, 0x7F)
        p2 = c.add_paragraph(); r = p2.add_run(title); r.font.size = Pt(28); r.font.bold = True; r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        p3 = c.add_paragraph(); r = p3.add_run(subtitle); r.font.size = Pt(12.5); r.font.color.rgb = RGBColor(0xDF, 0xF2, 0xEC)
        flag = d.add_table(rows=1, cols=3); _set_widths(flag, [5.53, 5.53, 5.54])
        for i, col in enumerate(('0B8A4D', 'CE1126', 'FCD116')):
            _shade(flag.cell(0, i), col); flag.cell(0, i).paragraphs[0].paragraph_format.space_after = Pt(0)
            flag.cell(0, i).paragraphs[0].add_run(' ').font.size = Pt(2)
        d.add_paragraph().paragraph_format.space_after = Pt(30)
        t = d.add_table(rows=0, cols=2); _borders(t); _cell_margins(t, 80, 80, 120, 120)
        for k, v in meta:
            row = t.add_row().cells
            _shade(row[0], 'F0F9F6')
            rk = row[0].paragraphs[0].add_run(k); rk.bold = True; rk.font.color.rgb = GREEN; rk.font.size = Pt(10)
            row[1].paragraphs[0].add_run(v).font.size = Pt(10)
        _set_widths(t, [5, 11.6])
        self.page_break()

    def toc(self, title='Sommaire'):
        tp = self.d.add_paragraph(); r = tp.add_run(title); r.bold = True; r.font.size = Pt(17); r.font.color.rgb = GREEN
        p = self.d.add_paragraph()
        _field(p, 'TOC \\o "1-2" \\h \\z \\u', 'Clic droit ▸ Mettre à jour les champs pour afficher le sommaire.')
        self.page_break()

    # ---------- contenu ----------
    def h1(self, t): return self.d.add_heading(t, 1)
    def h2(self, t): return self.d.add_heading(t, 2)
    def h3(self, t): return self.d.add_heading(t, 3)

    def p(self, text, bold_prefix=None, italic=False, align=None, size=None, color=None):
        para = self.d.add_paragraph()
        if bold_prefix:
            r = para.add_run(bold_prefix); r.bold = True
        self._rich(para, text, italic=italic, size=size, color=color)
        if align == 'center': para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif align == 'justify': para.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        return para

    def _rich(self, para, text, italic=False, size=None, color=None):
        # **gras** simple
        parts = text.split('**')
        for i, part in enumerate(parts):
            if not part: continue
            r = para.add_run(part); r.bold = (i % 2 == 1); r.italic = italic
            if size: r.font.size = Pt(size)
            if color: r.font.color.rgb = color

    def bullets(self, items, style='List Bullet'):
        for it in items:
            para = self.d.add_paragraph(style=style)
            para.paragraph_format.space_after = Pt(2)
            if isinstance(it, tuple): r = para.add_run(it[0]); r.bold = True; self._rich(para, it[1])
            else: self._rich(para, it)

    def numbered(self, items):
        """Liste numérotée qui repart à 1 (nouvelle instance de numérotation)."""
        numbering = self.d.part.numbering_part.numbering_definitions._numbering
        base = self.d.styles['List Number'].element.pPr.numPr.numId.val
        abstract_id = numbering.num_having_numId(base).abstractNumId.val
        num = numbering.add_num(abstract_id)
        num.add_lvlOverride(ilvl=0).add_startOverride(1)
        for it in items:
            para = self.d.add_paragraph(style='List Number'); para.paragraph_format.space_after = Pt(2)
            numPr = para._p.get_or_add_pPr().get_or_add_numPr()
            numPr.get_or_add_ilvl().val = 0; numPr.get_or_add_numId().val = num.numId
            self._rich(para, it)

    def table(self, header, rows, widths=None, caption=None, font=9.5, zebra=True):
        t = self.d.add_table(rows=1, cols=len(header)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
        _borders(t); _cell_margins(t)
        for i, h in enumerate(header):
            c = t.rows[0].cells[i]; _shade(c, '0B5D4B')
            r = c.paragraphs[0].add_run(h); r.bold = True; r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF); r.font.size = Pt(font)
        trPr = t.rows[0]._tr.get_or_add_trPr(); th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
        for ri, row in enumerate(rows):
            cells = t.add_row().cells
            for i, v in enumerate(row):
                para = cells[i].paragraphs[0]; para.paragraph_format.space_after = Pt(0)
                self._rich(para, str(v), size=font)
                if zebra and ri % 2: _shade(cells[i], 'F3F6F5')
        _set_widths(t, widths or [16.6 / len(header)] * len(header))
        if caption:
            self.tab += 1
            c = self.d.add_paragraph(f'Tableau {self.tab} — {caption}', style='Caption'); c.alignment = WD_ALIGN_PARAGRAPH.CENTER
        else:
            self.d.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    def note(self, text, kind='info'):
        fill, bar = {'info': ('EAF4FF', '175CD3'), 'warn': ('FEF6E7', 'C8962E'), 'ok': ('E8F5F0', '0B5D4B'), 'danger': ('FEECEB', 'B42318')}[kind]
        t = self.d.add_table(rows=1, cols=1); c = t.cell(0, 0); _shade(c, fill); _cell_margins(t, 100, 100, 160, 160); _set_widths(t, [16.6])
        tblPr = t._tbl.tblPr; b = OxmlElement('w:tblBorders')
        el = OxmlElement('w:left'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '24'); el.set(qn('w:color'), bar); b.append(el)
        tblPr.append(b)
        para = c.paragraphs[0]; para.paragraph_format.space_after = Pt(0)
        self._rich(para, text, size=10)
        self.d.add_paragraph().paragraph_format.space_after = Pt(0)

    def figure(self, path, caption, max_w=16.4, max_h=21.5):
        if not os.path.exists(path):
            self.p(f'[Image manquante : {path}]'); return
        w, h = Image.open(path).size
        width = max_w; height = width * h / w
        if height > max_h: height = max_h; width = height * w / h
        para = self.d.add_paragraph(); para.alignment = WD_ALIGN_PARAGRAPH.CENTER; para.paragraph_format.keep_with_next = True
        para.add_run().add_picture(path, width=Cm(width))
        self.fig += 1
        c = self.d.add_paragraph(f'Figure {self.fig} — {caption}', style='Caption'); c.alignment = WD_ALIGN_PARAGRAPH.CENTER

    def figures_row(self, paths, caption, width=5.2):
        t = self.d.add_table(rows=1, cols=len(paths)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
        for i, pth in enumerate(paths):
            para = t.cell(0, i).paragraphs[0]; para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            para.add_run().add_picture(pth, width=Cm(width))
        self.fig += 1
        c = self.d.add_paragraph(f'Figure {self.fig} — {caption}', style='Caption'); c.alignment = WD_ALIGN_PARAGRAPH.CENTER

    def _new_section(self, landscape):
        sec = self.d.add_section(WD_SECTION.NEW_PAGE)
        sec.orientation = WD_ORIENT.LANDSCAPE if landscape else WD_ORIENT.PORTRAIT
        sec.page_width, sec.page_height = (Cm(29.7), Cm(21)) if landscape else (Cm(21), Cm(29.7))
        sec.left_margin = sec.right_margin = Cm(2.2); sec.top_margin, sec.bottom_margin = Cm(2.0), Cm(1.8)
        sec.different_first_page_header_footer = False
        return sec

    def landscape(self, fn):
        """Insère un bloc de pages au format paysage (diagrammes larges)."""
        self._new_section(True); fn(); self._new_section(False)

    def page_break(self):
        self.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def save(self, path):
        settings = self.d.settings.element
        upd = OxmlElement('w:updateFields'); upd.set(qn('w:val'), 'true'); settings.append(upd)
        self.d.core_properties.title = self.title; self.d.core_properties.author = 'EduGest CM'; self.d.core_properties.language = 'fr-FR'
        self.d.save(path)
