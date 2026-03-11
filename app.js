const elements = {
  logo: document.querySelector("#brand-logo"),
  analyzeButton: document.querySelector("#analyze-button"),
  statusText: document.querySelector("#status-text"),
  errorText: document.querySelector("#error-text"),
  needle: document.querySelector("#needle"),
};

if (elements.logo) {
  elements.logo.addEventListener("error", () => {
    elements.logo.hidden = true;
  });
}

elements.analyzeButton?.addEventListener("click", () => {
  elements.statusText.textContent = "Engine integration is being initialized...";
  elements.errorText.hidden = true;
});

function setNeedleByCentipawn(cp) {
  const clamped = Math.max(-1000, Math.min(1000, cp));
  const angle = (clamped / 1000) * 90;
  if (elements.needle) {
    elements.needle.style.transform = `rotate(${angle}deg)`;
  }
}

setNeedleByCentipawn(0);
