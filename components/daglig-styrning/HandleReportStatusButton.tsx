"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateOperationalReportStatusAction } from "@/app/daglig-styrning/actions";

type HandleReportStatusButtonProps = {
  reportId: string;
};

export function HandleReportStatusButton({
  reportId,
}: HandleReportStatusButtonProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex h-7 shrink-0 items-center whitespace-nowrap px-2 text-xs relative z-10 appearance-none cursor-pointer transition-colors rounded-md bg-[#0284c7] font-semibold text-white hover:bg-[#075985]"
      onClick={() => {
        if (pending) return;
        const formData = new FormData();
        formData.set("id", reportId);
        formData.set("status", "hanteras");
        startTransition(async () => {
          await updateOperationalReportStatusAction(formData);
          router.refresh();
        });
      }}
    >
      Hanteras
    </button>
  );
}
