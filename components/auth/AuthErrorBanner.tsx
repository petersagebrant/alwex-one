type AuthErrorBannerProps = {
  error?: string;
};

export function AuthErrorBanner({ error }: AuthErrorBannerProps) {
  if (!error) {
    return null;
  }
  const text =
    error === "unauthorized"
      ? "Du saknar behörighet för den här åtgärden."
      : error;

  return (
    <p
      role="alert"
      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800"
    >
      {text}
    </p>
  );
}
