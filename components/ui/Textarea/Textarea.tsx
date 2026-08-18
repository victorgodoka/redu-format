import type { ComponentPropsWithoutRef } from "react";

export default function Textarea(props: ComponentPropsWithoutRef<"textarea">) {
  return <textarea {...props} />;
}
