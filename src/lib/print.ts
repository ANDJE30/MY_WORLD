/** Imprime (ou enregistre en PDF) un seul bloc de la page, au format demandé. */
export function printElement(selector: string, page: 'A5 landscape' | 'A4 portrait' | 'A4 landscape') {
  const el = document.querySelector<HTMLElement>(selector)
  if (!el) return
  const style = document.createElement('style')
  style.textContent = `@page { size: ${page}; margin: ${page.startsWith('A5') ? '0' : '12mm'}; }`
  document.head.appendChild(style)
  el.classList.add('print-area')
  const done = () => {
    el.classList.remove('print-area')
    style.remove()
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
}
