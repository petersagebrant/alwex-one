"use client";

import { useState, useTransition } from "react";
import { askAssistant } from "./actions";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Hur går Lager & Logistik?",
  "Hur går Recycling?",
  "Vilka KPI är röda?",
  "Vad ska jag prioritera idag?",
  "Finns några försenade aktiviteter?",
  "Vilka beslut är öppna?",
];

export function AssistantChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hej. Jag svarar på frågor om affärsområden, KPI:er, mål, aktiviteter och beslut utifrån aktuell data.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();

  function sendQuestion(question: string) {
    const trimmed = question.trim();
    if (!trimmed || isPending) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setDraft("");

    startTransition(async () => {
      try {
        const answer = await askAssistant(trimmed);
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: "assistant",
            content: answer,
          },
        ]);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Kunde inte hämta svar just nu.";
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content: message,
          },
        ]);
      }
    });
  }

  return (
    <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="border-b border-neutral-200 px-4 py-3 sm:px-5">
        <p className="text-sm font-semibold text-neutral-900">AI-assistent</p>
        <p className="mt-0.5 text-xs text-neutral-500">
          Svar baseras på aktuell verksamhetsdata.
        </p>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4 sm:px-5">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap ${
                message.role === "user"
                  ? "bg-[#111827] text-white"
                  : "bg-neutral-100 text-neutral-800"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}
        {isPending ? (
          <p className="text-xs text-neutral-500">Analyserar data…</p>
        ) : null}
      </div>

      <div className="space-y-3 border-t border-neutral-200 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              disabled={isPending}
              onClick={() => sendQuestion(suggestion)}
              className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            >
              {suggestion}
            </button>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendQuestion(draft);
          }}
        >
          <label htmlFor="assistant-question" className="sr-only">
            Fråga
          </label>
          <input
            id="assistant-question"
            name="question"
            type="text"
            value={draft}
            disabled={isPending}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Skriv din fråga…"
            className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition focus:border-[#5b5bd6] focus:ring-2 focus:ring-[#5b5bd6]/20 disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isPending || !draft.trim()}
            className="shrink-0 rounded-xl bg-[#111827] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Skicka
          </button>
        </form>
      </div>
    </div>
  );
}
