export const disableBrowserNativeBehaviors = () => {
  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "F5" ||
      ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "r")
    ) {
      event.preventDefault();
    }
  };

  const onContextMenu = (event: MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable)
    ) {
      return;
    }
    event.preventDefault();
  };

  document.addEventListener("keydown", onKeyDown);
  document.addEventListener("contextmenu", onContextMenu);

  window.addEventListener("beforeunload", () => {
    document.removeEventListener("keydown", onKeyDown);
    document.removeEventListener("contextmenu", onContextMenu);
  });
};
