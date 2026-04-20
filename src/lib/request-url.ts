const getFirstHeaderValue = (headers: Headers, name: string) =>
  headers
    .get(name)
    ?.split(",")[0]
    ?.trim();

export const getRequestOrigin = (headers: Headers, fallbackUrl?: string) => {
  const forwardedHost = getFirstHeaderValue(headers, "x-forwarded-host");
  const host = forwardedHost || getFirstHeaderValue(headers, "host");

  if (!host) {
    return fallbackUrl ? new URL(fallbackUrl).origin : undefined;
  }

  const forwardedProto = getFirstHeaderValue(headers, "x-forwarded-proto");
  const fallbackProtocol = fallbackUrl ? new URL(fallbackUrl).protocol.slice(0, -1) : "http";
  const protocol = forwardedProto || fallbackProtocol;

  return `${protocol}://${host}`;
};

export const createRequestUrl = (path: string, headers: Headers, fallbackUrl?: string) => {
  const origin = getRequestOrigin(headers, fallbackUrl) ?? "http://localhost";
  return new URL(path, origin);
};
