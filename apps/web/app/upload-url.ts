export function storageUploadUrl(
  signedUrl: string,
  apiUrl: string,
  pageHostname: string,
) {
  const usesLocalPage = pageHostname === "localhost" || pageHostname === "127.0.0.1";
  if (apiUrl.startsWith("/")) {
    return usesLocalPage
      ? "/__s3_proxy?url=" + encodeURIComponent(signedUrl)
      : signedUrl;
  }
  try {
    const parsedApiUrl = new URL(apiUrl);
    const usesLocalApi = parsedApiUrl.hostname === "localhost" || parsedApiUrl.hostname === "127.0.0.1";
    return usesLocalApi
      ? parsedApiUrl.origin + "/__s3_proxy?url=" + encodeURIComponent(signedUrl)
      : signedUrl;
  } catch {
    return signedUrl;
  }
}
