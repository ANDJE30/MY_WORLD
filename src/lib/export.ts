function download(name: string, mime: string, content: string) {
  const blob = new Blob(['﻿' + content], { type: `${mime};charset=utf-8` })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
}

const esc = (v: unknown) => {
  const s = String(v ?? '')
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV avec séparateur « ; » et BOM UTF-8 : s'ouvre directement dans Excel en configuration française. */
export function exportCsv(name: string, head: string[], rows: (string | number)[][]) {
  download(`${name}.csv`, 'text/csv', [head, ...rows].map((r) => r.map(esc).join(';')).join('\r\n'))
}

/** Classeur lisible par Excel (tableau HTML). */
export function exportExcel(name: string, head: string[], rows: (string | number)[][]) {
  const cell = (v: unknown, tag = 'td') => `<${tag}>${String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</${tag}>`
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table border="1"><tr>${head.map((h) => cell(h, 'th')).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => cell(c)).join('')}</tr>`).join('')}</table></body></html>`
  download(`${name}.xls`, 'application/vnd.ms-excel', html)
}
