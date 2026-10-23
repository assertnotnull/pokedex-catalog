import { Suspense } from "react";
import { connection } from "next/server";

async function Connected() {
  await connection();
  return null;
}

/** Lets hub metadata read the route id without blocking prefetch of the shell. */
export function DynamicMarker() {
  return (
    <Suspense fallback={null}>
      <Connected />
    </Suspense>
  );
}
