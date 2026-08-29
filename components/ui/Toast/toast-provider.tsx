"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import { ToastContainer } from "./toast-container"

import type {
  Toast,
  ToastOptions,
  ToastType,
} from "./toast.types"
import { ActionResult } from "@/lib/actions-utils"

export interface ToastCallback {
  onError: (error: string) => void
  onSuccess: (description?: string) => void
}

const toastCallback = (toast: ToastContextValue["toast"], tournamentName: string): ToastCallback => ({
  onError: (error: string) => toast.error(`Tournament Error: ${tournamentName}`, error),
  onSuccess: (description?: string) => toast.success("Tournament: " + tournamentName, description),
})

interface ToastContextValue {
  handleAction: (result: Promise<ActionResult<void>>, { onError, onSuccess }: ToastCallback) => Promise<ActionResult<void>>,
  toastCallback: (toast: ToastContextValue["toast"], tournamentName: string) => ToastCallback,
  toast: {
    success: (
      title: string,
      description?: string,
      options?: ToastOptions
    ) => void

    error: (
      title: string,
      description?: string,
      options?: ToastOptions
    ) => void

    info: (
      title: string,
      description?: string,
      options?: ToastOptions
    ) => void

    warning: (
      title: string,
      description?: string,
      options?: ToastOptions
    ) => void

    show: (
      type: ToastType,
      title: string,
      description?: string,
      options?: ToastOptions
    ) => void

    dismiss: (id: string) => void
    dismissAll: () => void
  }
}

const ToastContext = createContext<
  ToastContextValue | undefined
>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({
  children,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((current) =>
      current.filter((toast) => toast.id !== id)
    )
  }, [])

  const handleAction = useCallback(async (
    result: Promise<ActionResult<void>>, { onError, onSuccess }: ToastCallback
  ): Promise<ActionResult<void>> => {
    const actionResult = await result
    
    if (!actionResult.success) {
      onError(
        actionResult.error
      )

      return actionResult
    }

    onSuccess(actionResult.description)

    return actionResult
  }, [])

  const show = useCallback(
    (
      type: ToastType,
      title: string,
      description?: string,
      options?: ToastOptions
    ) => {
      const id = crypto.randomUUID()

      const toast: Toast = {
        id,
        type,
        title,
        description,
        duration: options?.duration ?? 5000,
      }

      setToasts((current) => [
        ...current,
        toast,
      ])

      if (toast.duration && toast.duration > 0) {
        window.setTimeout(() => {
          dismiss(id)
        }, toast.duration)
      }

      return id
    },
    [dismiss]
  )

  const dismissAll = useCallback(() => {
    setToasts([])
  }, [])

  const toast = useMemo(
    () => ({
      show,
      success: (
        title: string,
        description?: string,
        options?: ToastOptions
      ) =>
        show(
          "success",
          title,
          description,
          options
        ),

      error: (
        title: string,
        description?: string,
        options?: ToastOptions
      ) =>
        show(
          "error",
          title,
          description,
          options
        ),

      info: (
        title: string,
        description?: string,
        options?: ToastOptions
      ) =>
        show(
          "info",
          title,
          description,
          options
        ),

      warning: (
        title: string,
        description?: string,
        options?: ToastOptions
      ) =>
        show(
          "warning",
          title,
          description,
          options
        ),

      dismiss,
      dismissAll,
    }),
    [show, dismiss, dismissAll]
  )

  const value: ToastContextValue = useMemo(
    () => ({
      handleAction,
      toastCallback,
      toast,
    }),
    [handleAction, toast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}

      <ToastContainer
        toasts={toasts}
        onClose={dismiss}
      />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)

  if (!context) {
    throw new Error(
      "useToast must be used within ToastProvider"
    )
  }

  return context
}
