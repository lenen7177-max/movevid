type OpenProviderCheckoutUrlOptions = {
  newTab?: boolean;
};

export function openProviderCheckoutUrl(url: string, options: OpenProviderCheckoutUrlOptions = {}) {
  if (!options.newTab) {
    window.location.href = url;
    return;
  }

  const checkoutWindow = window.open(url, "_blank");
  if (checkoutWindow) {
    checkoutWindow.opener = null;
    return;
  }

  window.location.href = url;
}
