import type { ReactNode } from "react";

export default function FormField({
  label,
  htmlFor,
  hint,
  error,
  full,
  children,
}: {
  label: ReactNode;
  htmlFor: string;
  hint?: ReactNode;
  error?: ReactNode;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`form__field${full ? " form__field--full" : ""}`}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? <p className="form__hint">{hint}</p> : null}
      {error ? (
        <p role="alert" className="form__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
