(function registerPWA() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", function onLoad() {
    navigator.serviceWorker.register("./sw.js").catch(function onError(error) {
      console.error("Service worker registration failed:", error);
    });
  });
})();
