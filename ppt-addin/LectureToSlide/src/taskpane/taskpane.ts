/* global document, Office, PowerPoint */

Office.onReady((info) => {
  if (info.host === Office.HostType.PowerPoint) {
    const syncBtn = document.getElementById("sync-btn");
    if (syncBtn) {
      syncBtn.onclick = generateSlidesFromAI;
    }
  }
});

async function generateSlidesFromAI() {
  const codeInput = document.getElementById("join-code") as HTMLInputElement;
  const statusMsg = document.getElementById("status");
  const code = codeInput.value.trim();

  if (!code || code.length !== 6) {
    statusMsg.innerText = "Error: Need 6 digits.";
    return;
  }

  try {
    statusMsg.classList.remove("slidegen-status--success");
    statusMsg.innerHTML = "";
    statusMsg.innerText = "🚀 Fetching presentation...";
    statusMsg.classList.add("loading-pulse");

    const baseUrl = "https://listed-transaction-screw-phantom.trycloudflare.com";
    const url = `${baseUrl}/fetch-slides/${code}`;

    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-cache' });
    } catch (e) {
      console.log("Handshake attempted.");
    }

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
    });

    if (!response.ok) {
      const errBody = await response.text();
      let errMsg = `HTTP ${response.status}`;
      try {
        const j = JSON.parse(errBody);
        if (j.message) errMsg = j.message;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const contentType = response.headers.get("content-type") || "";
    const isPptx = contentType.includes("presentation") || contentType.includes("pptx");

    if (isPptx) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const filename = `SlideGen_${code}.pptx`;
      statusMsg.classList.remove("loading-pulse");
      statusMsg.classList.add("slidegen-status--success");
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
      statusMsg.innerHTML =
        '<span class="slidegen-success-check" aria-hidden="true">✓</span>' +
        '<span class="slidegen-success-text">🎉 Success! Your AI-designed presentation has been generated and downloaded. Open it to see the results!</span>';
      return;
    }

    const text = await response.text();
    try {
      const json = JSON.parse(text);
      if (json.error) {
        statusMsg.innerText = json.message || json.error || "No presentation found.";
        statusMsg.classList.remove("loading-pulse");
        return;
      }
    } catch (_) {}

    statusMsg.innerText = "No presentation found for this code.";
    statusMsg.classList.remove("loading-pulse");
  } catch (error) {
    console.error("FINAL ERROR:", error);
    if (error instanceof TypeError) {
      statusMsg.innerText = "Security: Right-click > Inspect > Console > Click URL.";
    } else {
      statusMsg.innerText = "Error: " + (error instanceof Error ? error.message : String(error));
    }
    statusMsg.classList.remove("loading-pulse");
  }
}
