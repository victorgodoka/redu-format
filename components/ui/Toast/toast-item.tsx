"use client"

import styles from "./toast-item.module.css"
import clsx from "clsx"
import type { Toast } from "./toast.types"
import { Icon } from "@iconify/react"

interface ToastItemProps {
  toast: Toast
  onClose: (id: string) => void
}

const toastConfig = {
  success: {
    icon: "material-symbols:check-circle-outline",
  },
  error: {
    icon: "mono-icons:circle-error",
  },
  info: {
    icon: "tdesign:error-circle",
  },
  warning: {
    icon: "oui:alert",
  },
}

export function ToastItem({
  toast,
  onClose,
}: ToastItemProps) {
  const config = toastConfig[toast.type]

  return (
    <div
      className={
        clsx(styles.item, styles[`item--${toast.type}`])
      }
      role="alert"
    >
      <div className={styles.wrapper}>
        <Icon
          icon={config.icon}
          className={clsx(styles.icon, styles[toast.type])}
        />
      </div>

      <div className={styles.toast}>
        <p className={styles.title}>
          {toast.title}
        </p>

        {toast.description && (
          <p className={styles.description}>
            {toast.description}
          </p>
        )}
      </div>

      <button
        type="button"
        className={styles.close}
        onClick={() => onClose(toast.id)}
        aria-label="Close notification"
      >
        <Icon icon="material-symbols:close" />
      </button>
    </div>
  )
}
