/**
 * rstn-wallet/popup-qr.js — Local QR rendering for the Receive view.
 *
 * Depends on qr.js (loaded before this file in popup.html).
 * Exposes window.rstnPopupQR.render(text, canvasId) which draws the
 * QR matrix onto a canvas element. The address never leaves the device.
 */
(function (global) {
  "use strict";

  function render(text, canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    try {
      const { size, matrix } = global.rstnQR.generate(text);
      const scale = 6;
      canvas.width = size * scale;
      canvas.height = size * scale;
      canvas.style.width = "180px";
      canvas.style.height = "180px";
      canvas.style.display = "block";
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#0a0a14";
      for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
          if (matrix[r][c]) ctx.fillRect(c * scale, r * scale, scale, scale);
        }
      }
    } catch (err) {
      console.warn("[RSTN] QR render failed:", err.message);
      canvas.style.display = "none";
    }
  }

  global.rstnPopupQR = { render };
})(typeof self !== "undefined" ? self : this);
