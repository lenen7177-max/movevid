export function getContentTypeFromKey(key: string): string | undefined {
  const extension = key.split(".").at(-1)?.toLowerCase();
  switch (extension) {
    case "gif":
      return "image/gif";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "txt":
      return "text/plain";
    case "webp":
      return "image/webp";
    default:
      return undefined;
  }
}
