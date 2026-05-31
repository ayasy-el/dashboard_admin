const GENERIC_SERVER_COMPONENT_ERROR =
  "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.";

export const normalizeErrorMessage = (message: string) => {
  const trimmed = message.trim();
  if (!trimmed) return "Terjadi kesalahan server. Coba lagi.";
  if (trimmed.includes(GENERIC_SERVER_COMPONENT_ERROR)) {
    return "Terjadi kesalahan server. Coba lagi.";
  }
  return trimmed;
};
