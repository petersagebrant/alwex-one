import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";
import { AssistantChat } from "./AssistantChat";

export const metadata: Metadata = {
  title: "AI-assistent | LEIR",
  description: "Ställ frågor om verksamheten utifrån aktuell data",
};

export default function AssistantPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-[#f7f8fa] text-neutral-900">
      <AppHeader current="assistant" />

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900">
            AI-assistent
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            Fråga om status, KPI:er, aktiviteter och prioriteringar.
          </p>
        </div>

        <AssistantChat />
      </main>
    </div>
  );
}
