"use client";

import Button from "@/components/ui/Button";

export default function DeleteButton({
  action,
  hidden,
  confirmText,
  label = "Delete",
}: {
  action: (form: FormData) => void | Promise<void>;
  hidden: Record<string, string>;
  confirmText: string;
  label?: string;
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
      <Button variant="danger" type="submit">
        {label}
      </Button>
    </form>
  );
}
