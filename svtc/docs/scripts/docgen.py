"""Mise en forme Word (python-docx) sur le papier en-tête officiel SVTC (bandeau, filigrane, pied de page)."""
import copy
import os
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.abspath(os.path.join(HERE, '..'))
TEMPLATE = os.path.join(DOCS, 'Papier_en-tete_SVTC.docx')

NAVY = RGBColor(0x0A, 0x16, 0x3A)
ROYAL = RGBColor(0x1D, 0x42, 0xAD)
GOLD = RGBColor(0xB7, 0x85, 0x07)
TEXT = RGBColor(0x1A, 0x1A, 0x2E)
MUTED = RGBColor(0x64, 0x74, 0x8B)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
FONT = 'Poppins'
TEXT_W = 16.6  # largeur utile en cm (A4, marges 2,2 cm du papier en-tête)


def _shade(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    for old in tcPr.findall(qn('w:shd')):
        tcPr.remove(old)
    shd = OxmlElement('w:shd'); shd.set(qn('w:val'), 'clear'); shd.set(qn('w:color'), 'auto'); shd.set(qn('w:fill'), fill)
    tcPr.append(shd)


def _cell_margins(table, top=50, bottom=50, left=90, right=90):
    mar = OxmlElement('w:tblCellMar')
    for k, v in (('top', top), ('left', left), ('bottom', bottom), ('right', right)):
        el = OxmlElement(f'w:{k}'); el.set(qn('w:w'), str(v)); el.set(qn('w:type'), 'dxa'); mar.append(el)
    table._tbl.tblPr.append(mar)


def _borders(table, color='D9E0EF', size=4, inside=True):
    b = OxmlElement('w:tblBorders')
    edges = ('top', 'left', 'bottom', 'right') + (('insideH', 'insideV') if inside else ())
    for edge in edges:
        el = OxmlElement(f'w:{edge}'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), str(size)); el.set(qn('w:color'), color)
        b.append(el)
    table._tbl.tblPr.append(b)


def _no_borders(table):
    b = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        el = OxmlElement(f'w:{edge}'); el.set(qn('w:val'), 'nil'); b.append(el)
    table._tbl.tblPr.append(b)


def _widths(table, widths):
    table.autofit = False
    tblPr = table._tbl.tblPr
    lay = OxmlElement('w:tblLayout'); lay.set(qn('w:type'), 'fixed'); tblPr.append(lay)
    for old in tblPr.findall(qn('w:tblW')):
        tblPr.remove(old)
    tw = OxmlElement('w:tblW'); tw.set(qn('w:w'), str(int(sum(widths) * 567))); tw.set(qn('w:type'), 'dxa'); tblPr.append(tw)
    for i, w in enumerate(widths):
        table.columns[i].width = Cm(w)
        for row in table.rows:
            row.cells[i].width = Cm(w)


def _field(paragraph, instr, placeholder=''):
    run = paragraph.add_run()
    for tag, attr in (('w:fldChar', 'begin'), ('w:instrText', None), ('w:fldChar', 'separate'), ('w:t', None), ('w:fldChar', 'end')):
        el = OxmlElement(tag)
        if tag == 'w:fldChar':
            el.set(qn('w:fldCharType'), attr)
        elif tag == 'w:instrText':
            el.set(qn('xml:space'), 'preserve'); el.text = instr
        else:
            el.text = placeholder
        run._r.append(el)
    return run


def _para_border_bottom(p, color='F2C318', size=12, space=4):
    pPr = p._p.get_or_add_pPr()
    bdr = OxmlElement('w:pBdr')
    b = OxmlElement('w:bottom'); b.set(qn('w:val'), 'single'); b.set(qn('w:sz'), str(size)); b.set(qn('w:space'), str(space)); b.set(qn('w:color'), color)
    bdr.append(b); pPr.append(bdr)


def _keep_together(row):
    trPr = row._tr.get_or_add_trPr()
    c = OxmlElement('w:cantSplit'); c.set(qn('w:val'), 'true'); trPr.append(c)


_CACHE = os.path.join(DOCS, '.cache')


def _light(path, max_px=1500):
    """Allège les captures d'écran (JPEG, 1500 px max) pour des fichiers Word faciles à partager."""
    if 'captures' not in path and 'couverture' not in path:
        return path
    os.makedirs(_CACHE, exist_ok=True)
    out = os.path.join(_CACHE, os.path.basename(path).rsplit('.', 1)[0] + '.jpg')
    if not os.path.exists(out) or os.path.getmtime(out) < os.path.getmtime(path):
        im = Image.open(path)
        if im.mode in ('RGBA', 'LA', 'P'):
            bg = Image.new('RGB', im.size, 'white')
            im = im.convert('RGBA'); bg.paste(im, mask=im.split()[-1]); im = bg
        im = im.convert('RGB')
        if im.width > max_px:
            im = im.resize((max_px, int(im.height * max_px / im.width)), Image.LANCZOS)
        im.save(out, quality=84, optimize=True, progressive=True)
    return out


class Doc:
    def __init__(self, title, short):
        self.d = Document(TEMPLATE)
        self.title, self.short = title, short
        self.fig = 0
        self.tab = 0
        # Noms de styles du modèle : python-docx attend « heading 1 » (nom interne de Word)
        for el in self.d.styles.element.findall(qn('w:style')):
            nm = el.find(qn('w:name'))
            if nm is not None and nm.get(qn('w:val'), '').startswith('Heading '):
                nm.set(qn('w:val'), nm.get(qn('w:val')).lower())
        body = self.d.element.body
        for el in list(body):
            if el.tag != qn('w:sectPr'):
                body.remove(el)
        self._styles()

    # ------------------------------------------------------------ styles
    def _font(self, style, size, color=None, bold=None, italic=None):
        f = style.font
        f.name = FONT; f.size = Pt(size)
        if color is not None: f.color.rgb = color
        if bold is not None: f.bold = bold
        if italic is not None: f.italic = italic
        rpr = style.element.get_or_add_rPr()
        fonts = rpr.find(qn('w:rFonts'))
        if fonts is None:
            fonts = OxmlElement('w:rFonts'); rpr.append(fonts)
        for a in ('w:ascii', 'w:hAnsi', 'w:cs', 'w:eastAsia'):
            fonts.set(qn(a), FONT)

    def _styles(self):
        st = self.d.styles
        n = st['Normal']
        self._font(n, 10, TEXT)
        n.paragraph_format.space_after = Pt(5)
        n.paragraph_format.line_spacing = 1.15
        spec = {1: (16, NAVY, 16, 8), 2: (12.5, ROYAL, 12, 5), 3: (11, GOLD, 9, 4)}
        for lvl, (size, color, before, after) in spec.items():
            h = st[f'Heading {lvl}']
            self._font(h, size, color, bold=True, italic=False)
            pf = h.paragraph_format
            pf.space_before = Pt(before); pf.space_after = Pt(after); pf.keep_with_next = True
            pf.alignment = WD_ALIGN_PARAGRAPH.LEFT
            pPr = h.element.get_or_add_pPr()
            ol = OxmlElement('w:outlineLvl'); ol.set(qn('w:val'), str(lvl - 1)); pPr.append(ol)
        try:
            cap = st['Caption']
        except KeyError:
            cap = st.add_style('Caption', WD_STYLE_TYPE.PARAGRAPH); cap.base_style = st['Normal']
        self._font(cap, 8.5, MUTED, bold=False, italic=True)
        cap.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.CENTER
        cap.paragraph_format.space_after = Pt(10)
        for name, lvl in (('toc 1', 0), ('toc 2', 1)):
            try:
                s = st[name]
            except KeyError:
                s = st.add_style(name, WD_STYLE_TYPE.PARAGRAPH); s.base_style = st['Normal']
            self._font(s, 10 if lvl == 0 else 9.5, NAVY if lvl == 0 else TEXT, bold=(lvl == 0))
            s.paragraph_format.left_indent = Cm(0.6 * lvl)
            s.paragraph_format.space_after = Pt(1)
            s.paragraph_format.space_before = Pt(3 if lvl == 0 else 0)
            s.paragraph_format.line_spacing = 1.0

    # ------------------------------------------------------------ blocs
    def cover(self, kind, title, subtitle, meta, motto=None, image=None):
        d = self.d
        p = d.add_paragraph(); p.paragraph_format.space_before = Pt(18); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(kind.upper()); r.bold = True; r.font.size = Pt(11); r.font.color.rgb = GOLD
        r.font.name = FONT
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after = Pt(2)
        r = p.add_run(title); r.bold = True; r.font.size = Pt(30); r.font.color.rgb = NAVY
        p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        r = p.add_run(subtitle); r.font.size = Pt(12); r.font.color.rgb = ROYAL
        _para_border_bottom(p, 'F2C318', 18, 10)
        d.add_paragraph().paragraph_format.space_after = Pt(14)
        t = d.add_table(rows=0, cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER
        _borders(t, 'D9E0EF', 4); _cell_margins(t, 70, 70, 120, 120)
        for k, v in meta:
            row = t.add_row(); _keep_together(row)
            c0, c1 = row.cells
            _shade(c0, '0A163A')
            rk = c0.paragraphs[0].add_run(k); rk.bold = True; rk.font.color.rgb = RGBColor(0xF2, 0xC3, 0x18); rk.font.size = Pt(9.5)
            c1.paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.LEFT
            self._rich(c1.paragraphs[0], v, size=9.5)
            for c in (c0, c1): c.paragraphs[0].paragraph_format.space_after = Pt(0)
        _widths(t, [4.6, 12.0])
        if image and os.path.exists(image):
            p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(14)
            p.add_run().add_picture(_light(image, 1800), width=Cm(12))
        if motto:
            p = d.add_paragraph(); p.alignment = WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_before = Pt(12 if image else 26)
            self._rich(p, motto, italic=True, size=11, color=NAVY)
        self.page_break()

    def toc(self, title='Sommaire'):
        p = self.d.add_paragraph(); r = p.add_run(title); r.bold = True; r.font.size = Pt(16); r.font.color.rgb = NAVY
        _para_border_bottom(p)
        p = self.d.add_paragraph()
        _field(p, 'TOC \\o "1-2" \\h \\z \\u', 'Clic droit ▸ Mettre à jour les champs pour afficher le sommaire.')
        self.page_break()

    def h1(self, t):
        h = self.d.add_heading(t, 1); _para_border_bottom(h, 'F2C318', 10, 3); return h

    def h2(self, t): return self.d.add_heading(t, 2)
    def h3(self, t): return self.d.add_heading(t, 3)

    def _rich(self, para, text, italic=False, size=None, color=None, bold=False):
        for i, part in enumerate(text.split('**')):
            if not part:
                continue
            r = para.add_run(part); r.bold = bold or (i % 2 == 1); r.italic = italic
            if size: r.font.size = Pt(size)
            if color is not None: r.font.color.rgb = color

    def p(self, text, align='justify', italic=False, size=None, color=None, after=None):
        para = self.d.add_paragraph()
        self._rich(para, text, italic=italic, size=size, color=color)
        para.alignment = {'justify': WD_ALIGN_PARAGRAPH.JUSTIFY, 'center': WD_ALIGN_PARAGRAPH.CENTER, 'left': WD_ALIGN_PARAGRAPH.LEFT}[align]
        if after is not None: para.paragraph_format.space_after = Pt(after)
        return para

    def bullets(self, items, mark='▪'):
        for it in items:
            para = self.d.add_paragraph()
            pf = para.paragraph_format
            pf.left_indent = Cm(0.75); pf.first_line_indent = Cm(-0.45); pf.space_after = Pt(2.5)
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = para.add_run(f'{mark}\t'); r.font.color.rgb = GOLD; r.bold = True
            pf.tab_stops.add_tab_stop(Cm(0.75))
            if isinstance(it, tuple):
                rb = para.add_run(it[0]); rb.bold = True; rb.font.color.rgb = NAVY
                self._rich(para, it[1])
            else:
                self._rich(para, it)

    def steps(self, items):
        for i, it in enumerate(items, 1):
            para = self.d.add_paragraph()
            pf = para.paragraph_format
            pf.left_indent = Cm(0.85); pf.first_line_indent = Cm(-0.6); pf.space_after = Pt(3)
            pf.tab_stops.add_tab_stop(Cm(0.85))
            para.alignment = WD_ALIGN_PARAGRAPH.LEFT
            r = para.add_run(f'{i}.\t'); r.bold = True; r.font.color.rgb = ROYAL
            self._rich(para, it)

    def table(self, header, rows, widths=None, caption=None, font=8.8, zebra=True):
        t = self.d.add_table(rows=1, cols=len(header)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
        _borders(t); _cell_margins(t)
        for i, h in enumerate(header):
            c = t.rows[0].cells[i]; _shade(c, '0A163A')
            par = c.paragraphs[0]; par.alignment = WD_ALIGN_PARAGRAPH.LEFT; par.paragraph_format.space_after = Pt(0)
            r = par.add_run(h); r.bold = True; r.font.color.rgb = WHITE; r.font.size = Pt(font)
        trPr = t.rows[0]._tr.get_or_add_trPr(); th = OxmlElement('w:tblHeader'); th.set(qn('w:val'), 'true'); trPr.append(th)
        for ri, row in enumerate(rows):
            r_ = t.add_row(); _keep_together(r_)
            for i, v in enumerate(row):
                cell = r_.cells[i]
                par = cell.paragraphs[0]; par.paragraph_format.space_after = Pt(0); par.alignment = WD_ALIGN_PARAGRAPH.LEFT
                par.paragraph_format.line_spacing = 1.05
                self._rich(par, str(v), size=font)
                if zebra and ri % 2: _shade(cell, 'EEF3FF')
        _widths(t, widths or [TEXT_W / len(header)] * len(header))
        if caption:
            self.tab += 1
            self.d.add_paragraph(f'Tableau {self.tab} — {caption}', style='Caption')
        else:
            self.d.add_paragraph().paragraph_format.space_after = Pt(2)
        return t

    def note(self, text, kind='info'):
        fill, bar = {'info': ('EEF3FF', '2453D6'), 'warn': ('FFF8E1', 'DBA90B'), 'ok': ('ECFDF5', '059669'), 'danger': ('FFF1F2', 'BE123C')}[kind]
        t = self.d.add_table(rows=1, cols=1); c = t.cell(0, 0); _shade(c, fill); _cell_margins(t, 100, 100, 160, 160)
        b = OxmlElement('w:tblBorders')
        el = OxmlElement('w:left'); el.set(qn('w:val'), 'single'); el.set(qn('w:sz'), '24'); el.set(qn('w:color'), bar); b.append(el)
        t._tbl.tblPr.append(b)
        _widths(t, [TEXT_W])
        para = c.paragraphs[0]; para.paragraph_format.space_after = Pt(0); para.alignment = WD_ALIGN_PARAGRAPH.LEFT
        self._rich(para, text, size=9.5)
        self.d.add_paragraph().paragraph_format.space_after = Pt(0)

    def figure(self, path, caption, max_w=TEXT_W, max_h=19.5, rotate_if_wide=False):
        if not os.path.exists(path):
            self.p(f'[Image manquante : {os.path.basename(path)}]'); return
        im = Image.open(path)
        w, h = im.size
        if rotate_if_wide and w / h > 1.9:
            rot = path.replace('.png', '_rot.png')
            im.rotate(90, expand=True).save(rot); path = rot; w, h = h, w
        width = max_w; height = width * h / w
        if height > max_h:
            height = max_h; width = height * w / h
        para = self.d.add_paragraph(); para.alignment = WD_ALIGN_PARAGRAPH.CENTER
        para.paragraph_format.keep_with_next = True; para.paragraph_format.space_after = Pt(2)
        para.add_run().add_picture(_light(path), width=Cm(width))
        self.fig += 1
        self.d.add_paragraph(f'Figure {self.fig} — {caption}', style='Caption')

    def figures_row(self, paths, caption, width=5.0):
        t = self.d.add_table(rows=1, cols=len(paths)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
        _no_borders(t)
        for i, pth in enumerate(paths):
            para = t.cell(0, i).paragraphs[0]; para.alignment = WD_ALIGN_PARAGRAPH.CENTER
            if os.path.exists(pth):
                para.add_run().add_picture(_light(pth, 900), width=Cm(width))
        _widths(t, [TEXT_W / len(paths)] * len(paths))
        self.fig += 1
        self.d.add_paragraph(f'Figure {self.fig} — {caption}', style='Caption')

    def page_break(self):
        self.d.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

    def save(self, path):
        settings = self.d.settings.element
        upd = OxmlElement('w:updateFields'); upd.set(qn('w:val'), 'true'); settings.append(upd)
        cp = self.d.core_properties
        cp.title = self.title; cp.author = 'SILICON VALLEY TRAINING CENTER'; cp.language = 'fr-FR'; cp.subject = self.short
        self.d.save(path)
