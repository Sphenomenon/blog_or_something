// Keep the browser's native behavior for modified clicks and new-tab links.
export function navigateFromLink(event, navigate) {
  if (
    !navigate || event.defaultPrevented || event.button !== 0 ||
    event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
    event.currentTarget.hasAttribute("download") ||
    (event.currentTarget.target && event.currentTarget.target !== "_self")
  ) {
    return;
  }

  event.preventDefault();
  navigate();
}
