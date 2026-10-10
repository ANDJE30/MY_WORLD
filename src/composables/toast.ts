import { reactive } from 'vue'

export interface ToastItem { id: number; kind: 'info' | 'success' | 'error'; title: string; text?: string }
export const toasts = reactive<ToastItem[]>([])
let n = 0

export function toast(kind: ToastItem['kind'], title: string, text?: string, ms = 5200) {
  const id = ++n
  toasts.push({ id, kind, title, text })
  window.setTimeout(() => dismiss(id), ms)
}
export function dismiss(id: number) {
  const i = toasts.findIndex((t) => t.id === id)
  if (i >= 0) toasts.splice(i, 1)
}
