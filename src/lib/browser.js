// Cross-browser API shim: Firefox/Safari expose `browser`, Chromium exposes `chrome`.
// In Manifest V3 both return promises from storage/runtime/tabs calls.
(function (root) {
  const TT = (root.TT = root.TT || {});
  TT.api = root.browser || root.chrome;
})(globalThis);
