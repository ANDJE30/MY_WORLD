// Documents Word (.docx) sans dépendance : écriture (modèles modifiables) et lecture (chronogrammes importés).
// Un .docx est une archive ZIP de fichiers XML (WordprocessingML) : on l'écrit et on la lit avec zlib.
import zlib from 'node:zlib';

/* ======================= ZIP ======================= */
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Archive ZIP (compression « deflate ») à partir de [{ name, data }]. */
export function zip(files) {
  const locals = [], centrals = []; let offset = 0;
  const d = new Date(); const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1); const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'); const raw = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(raw, { level: 9 }); const crc = crc32(raw);
    const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(time, 10); lh.writeUInt16LE(date, 12); lh.writeUInt32LE(crc, 14); lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(raw.length, 22); lh.writeUInt16LE(name.length, 26);
    locals.push(lh, name, comp);
    const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(time, 12); ch.writeUInt16LE(date, 14); ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(offset, 42);
    centrals.push(ch, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}
/** Lecture d'une archive ZIP : Map nom → Buffer. */
export function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('Archive ZIP invalide');
  const count = buf.readUInt16LE(e + 10); let p = buf.readUInt32LE(e + 16);
  const out = new Map();
  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Archive ZIP invalide');
    const method = buf.readUInt16LE(p + 10), csize = buf.readUInt32LE(p + 20), nlen = buf.readUInt16LE(p + 28), xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lo = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nlen).toString('utf8');
    const ds = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const data = buf.subarray(ds, ds + csize);
    if (method === 0) out.set(name, Buffer.from(data)); else if (method === 8) out.set(name, zlib.inflateRawSync(data)); // autres méthodes ignorées
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

/* ======================= Lecture d'un .docx ======================= */
const unxml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
const runText = (xml) => {
  let out = '';
  for (const m of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g)) out += m[1] !== undefined ? unxml(m[1]) : m[0].startsWith('<w:tab') ? ' ' : '\n';
  return out;
};
const paraText = (pxml) => runText(pxml).replace(/[ \t ]+/g, ' ').trim();
/** Tableaux (lignes → cellules) et paragraphes hors tableaux d'un document Word. */
export function readDocx(buf) {
  const files = unzip(buf);
  const xml = files.get('word/document.xml')?.toString('utf8');
  if (!xml) throw new Error("Ce fichier n'est pas un document Word (.docx) valide.");
  const tables = [];
  const noTables = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, (tbl) => {
    const rows = [];
    for (const tr of tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) || []) {
      const cells = (tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map((tc) => (tc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).filter(Boolean).join(' '));
      if (cells.some(Boolean)) rows.push(cells);
    }
    tables.push(rows);
    return '';
  });
  const paragraphs = (noTables.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || []).map(paraText).filter(Boolean);
  return { tables, paragraphs };
}

/* ======================= Écriture d'un .docx ======================= */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const PT = (n) => Math.round(n * 2); // demi-points
/** Segment de texte : r('texte', { b, i, u, size, color, font, caps }). */
export const r = (text, o = {}) => ({ text: String(text ?? ''), ...o });
function runXml(run) {
  const pr = [run.font ? `<w:rFonts w:ascii="${run.font}" w:hAnsi="${run.font}" w:cs="${run.font}"/>` : '', run.b ? '<w:b/>' : '', run.i ? '<w:i/>' : '', run.caps ? '<w:caps/>' : '',
    run.u ? '<w:u w:val="single"/>' : '', run.color ? `<w:color w:val="${run.color.replace('#', '')}"/>` : '', run.size ? `<w:sz w:val="${PT(run.size)}"/><w:szCs w:val="${PT(run.size)}"/>` : '',
    run.spacing ? `<w:spacing w:val="${run.spacing}"/>` : ''].join('');
  return String(run.text).split('\n').map((t, i) => `${i ? '<w:r><w:br/></w:r>' : ''}<w:r>${pr ? `<w:rPr>${pr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`).join('');
}
/** Paragraphe : p([runs] | 'texte', { align: left|center|right|both, before, after, indent, firstLine, keepNext, style, line }). */
export function p(runs, o = {}) {
  const rs = typeof runs === 'string' ? [r(runs)] : runs;
  const ppr = [o.style ? `<w:pStyle w:val="${o.style}"/>` : '', o.keepNext ? '<w:keepNext/>' : '',
    `<w:spacing w:before="${Math.round((o.before ?? 0) * 20)}" w:after="${Math.round((o.after ?? 6) * 20)}"${o.line ? ` w:line="${Math.round(o.line * 240)}" w:lineRule="auto"` : ''}/>`,
    o.indent || o.firstLine ? `<w:ind w:left="${Math.round((o.indent || 0) * 567)}" w:firstLine="${Math.round((o.firstLine || 0) * 567)}"/>` : '',
    o.border ? '<w:pBdr><w:bottom w:val="single" w:sz="8" w:space="1" w:color="333333"/></w:pBdr>' : '',
    o.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.shade.replace('#', '')}"/>` : '',
    o.align ? `<w:jc w:val="${o.align}"/>` : ''].join('');
  return `<w:p><w:pPr>${ppr}</w:pPr>${rs.map((x) => (typeof x === 'string' ? x : runXml(x))).join('')}</w:p>`;
}
/** Tableau : rows = [[cellule…]…] ; cellule = 'texte' | { content: [paragraphes xml] | 'texte', b, shade, align, span }. widths en cm. */
export function table(rows, { widths, header = true, borders = true, fontSize = 10, headerShade = 'E7E6E0' } = {}) {
  // largeurs par défaut : colonnes égales sur la largeur utile d'une page A4 portrait (17 cm)
  if (!widths) { const n = Math.max(1, ...rows.map((row) => row.reduce((k, c) => k + ((c && c.span) || 1), 0))); widths = Array(n).fill(17 / n); }
  const grid = widths.map((w) => `<w:gridCol w:w="${Math.round(w * 567)}"/>`).join('');
  const bd = borders ? '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="555555"/>`).join('') + '</w:tblBorders>'
    : '<w:tblBorders>' + ['top', 'left', 'bottom', 'right', 'insideH', 'insideV'].map((s) => `<w:${s} w:val="nil"/>`).join('') + '</w:tblBorders>';
  const trs = rows.map((row, ri) => `<w:tr>${ri === 0 && header ? '<w:trPr><w:tblHeader/></w:trPr>' : ''}${row.map((c, ci) => {
    const cell = typeof c === 'object' && c !== null && !Array.isArray(c) ? c : { content: c };
    const isHead = ri === 0 && header;
    const content = Array.isArray(cell.content) ? cell.content.join('')
      : p([r(cell.content ?? '', { b: cell.b || isHead, size: cell.size || fontSize, i: cell.i, color: cell.color })], { align: cell.align || (isHead ? 'center' : 'left'), after: 0 });
    const w = widths.slice(ci, ci + (cell.span || 1)).reduce((a, x) => a + x, 0);
    return `<w:tc><w:tcPr><w:tcW w:w="${Math.round(w * 567)}" w:type="dxa"/>${cell.span > 1 ? `<w:gridSpan w:val="${cell.span}"/>` : ''}${isHead || cell.shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${(cell.shade || headerShade).replace('#', '')}"/>` : ''}<w:vAlign w:val="${cell.valign || 'center'}"/></w:tcPr>${content}</w:tc>`;
  }).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${Math.round(widths.reduce((a, x) => a + x, 0) * 567)}" w:type="dxa"/><w:jc w:val="center"/>${bd}<w:tblLayout w:type="fixed"/>`
    + `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="80" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>`;
}
/** Image en ligne (logo) : référence à remplir par le document. */
export function image(rid, wCm, hCm, idn = 1) {
  const cx = Math.round(wCm * 360000), cy = Math.round(hCm * 360000);
  return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${idn}" name="Logo ${idn}"/>`
    + '<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>'
    + '<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">'
    + `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${idn}" name="logo"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>`
    + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>';
}
export const pageBreak = () => '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';

/** Assemble le document : body = chaînes XML (paragraphes, tableaux) ; images = [{ rid, data, ext }]. */
export function buildDocx({ body, images = [], title = 'Document', author = 'AI721 SchoolX CM', font = 'Times New Roman', size = 12, landscape = false }) {
  const W = landscape ? 16838 : 11906, H = landscape ? 11906 : 16838;
  const doc = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    + 'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    + 'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>'
    + body.join('')
    + `<w:sectPr><w:pgSz w:w="${W}" w:h="${H}"${landscape ? ' w:orient="landscape"' : ''}/><w:pgMar w:top="1021" w:right="1134" w:bottom="1021" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  const styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
    + `<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${font}" w:hAnsi="${font}" w:cs="${font}" w:eastAsia="${font}"/><w:sz w:val="${PT(size)}"/><w:szCs w:val="${PT(size)}"/><w:lang w:val="fr-FR"/></w:rPr></w:rPrDefault>`
    + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
    + '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
    + `<w:style w:type="paragraph" w:styleId="Titre1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:caps/><w:sz w:val="${PT(size + 1)}"/></w:rPr></w:style>`
    + `<w:style w:type="paragraph" w:styleId="Titre2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:keepNext/><w:spacing w:before="160" w:after="80"/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="${PT(size)}"/></w:rPr></w:style>`
    + '</w:styles>';
  const ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    + '<Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/>'
    + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
    + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>'
    + '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  const rels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  const docRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + images.map((im) => `<Relationship Id="${im.rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${im.rid}.${im.ext}"/>`).join('') + '</Relationships>';
  const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" '
    + 'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">'
    + `<dc:title>${esc(title)}</dc:title><dc:creator>${esc(author)}</dc:creator><dc:language>fr-FR</dc:language>`
    + `<dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
  return zip([{ name: '[Content_Types].xml', data: ct }, { name: '_rels/.rels', data: rels }, { name: 'word/document.xml', data: doc },
    { name: 'word/styles.xml', data: styles }, { name: 'word/_rels/document.xml.rels', data: docRels }, { name: 'docProps/core.xml', data: core },
    ...images.map((im) => ({ name: `word/media/${im.rid}.${im.ext}`, data: im.data }))]);
}
