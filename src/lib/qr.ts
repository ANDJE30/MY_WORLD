import qrcode from 'qrcode-generator'

/** Code QR en SVG (correction d'erreur M), prêt à être inséré dans la facture. */
export function qrSvg(text: string, size = 4): string {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  return qr.createSvgTag({ cellSize: size, margin: 0, scalable: true })
}
