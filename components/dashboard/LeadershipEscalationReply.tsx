"use client";

import { useState } from "react";
import { answerEscalationAction } from "@/app/daglig-styrning/actions";
import {
  boardCancelButtonClass,
  boardFieldClass,
  boardPrimaryButtonClass,
} from "@/components/daglig-styrning/boardStyles";

type LeadershipEscalationReplyProps = {
  escalationId: string;
};

export function LeadershipEscalationReply({
  escalationId,
}: LeadershipEscalationReplyProps) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center rounded-lg bg-[#0b1220] px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Besvara
      </button>
    );
  }

  return (
    <form
      action={async (formData) => {
        await answerEscalationAction(formData);
        setOpen(false);
      }}
      className="w-full max-w-sm space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2.5"
    >
      <input type="hidden" name="id" value={escalationId} />
      <label className="block">
        <span className="block text-[11px] font-medium text-slate-600">
          Beslut / svar
        </span>
        <textarea
          name="reply"
          required
          rows={2}
          className={`${boardFieldClass} mt-1 w-full`}
        />
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="submit" className={boardPrimaryButtonClass}>
          Spara svar
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={boardCancelButtonClass}
        >
          Avbryt
        </button>
      </div>
    </form>
  );
}
