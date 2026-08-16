import type { ComponentPropsWithoutRef } from "react";

export default function Input(props: ComponentPropsWithoutRef<"input">) {
  return <input {...props} />;
}
