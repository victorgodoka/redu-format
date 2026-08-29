export type ActionResult<T = void> =
  | {
      success: true
      data?: T
      description?: string
      redirect?: string
    }
  | {
      success: false
      error: string
      redirect?: string
    }

export const actionError = (
  error: string,
  redirect?: string,
  callback?: () => void
): ActionResult<never> => {
  callback?.()

  return {
    success: false,
    error,
    redirect
  }
}

export const actionSuccess = <T = void>(
  data?: T,
  description?: string,
  redirect?: string
): ActionResult<T> => ({
  success: true,
  data,
  description,
  redirect
})
