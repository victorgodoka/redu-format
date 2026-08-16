import type { ComponentPropsWithoutRef } from "react";

export default function Select(props: ComponentPropsWithoutRef<"select">) {
  return <select {...props} />;
}
