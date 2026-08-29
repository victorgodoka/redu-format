"use client"
import styles from "./toast-container.module.css"
import type { Toast } from "./toast.types"
import { ToastItem } from "./toast-item"

interface ToastContainerProps {
  toasts: Toast[]
  onClose: (id: string) => void
}

export function ToastContainer({
  toasts,
  onClose,
}: ToastContainerProps) {
  return (
    <div
      className={styles.container}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onClose={onClose}
        />
      ))}
    </div>
  )
}
