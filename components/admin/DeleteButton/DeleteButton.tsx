"use client";

import Button from "@/components/ui/Button";

export default function DeleteButton({
  action,
  hidden,
  confirmText,
  label = "Delete",
  variant = "danger",
}: {
  action: (form: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  confirmText: string;
  label?: string;
  /** Not every confirm-first action is destructive - "Send prizing" reuses this for the dialog, not the red button. */
  variant?: "danger" | "solid";
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <Button variant={variant} type="submit">
        {label}
      </Button>
    </form>
  );
}
