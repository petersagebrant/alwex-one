import Link from "next/link";

export default function ActivityNotFound() {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center bg-[#f7f8fa] px-4 text-center">
      <h1 className="text-xl font-semibold text-neutral-900">
        Aktiviteten hittades inte
      </h1>
      <p className="mt-2 text-sm text-neutral-500">
        Kontrollera adressen eller gå tillbaka till listan.
      </p>
      <Link
        href="/admin/activities"
        className="mt-6 rounded-lg bg-[#111827] px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Till aktiviteter
      </Link>
    </div>
  );
}
