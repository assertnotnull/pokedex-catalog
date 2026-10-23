import type { ReactNode } from "react";
import { Footer } from "@/components/shell/footer";
import { Navbar } from "@/components/shell/navbar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Navbar />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
      <Footer />
    </>
  );
}
