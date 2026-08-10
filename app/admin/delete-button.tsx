"use client";

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
      <button className="btn btn--danger" type="submit">
        {label}
      </button>
    </form>
  );
}
