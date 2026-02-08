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
    statusMsg.innerText = "🚀 Syncing with AI...";
    statusMsg.classList.add("loading-pulse");

    const url = `https://listed-transaction-screw-phantom.trycloudflare.com/fetch-slides/${code}`;

    // SAFARI FIX 1: The Handshake
    try {
      await fetch(url, { mode: 'no-cors', cache: 'no-cache' });
    } catch (e) {
      console.log("Handshake attempted.");
    }

    // SAFARI FIX 2: Simple Fetch
    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const slidesData = await response.json();
    if (!slidesData || slidesData.length === 0) {
      statusMsg.innerText = "No data found for this code.";
      statusMsg.classList.remove("loading-pulse");
      return;
    }

    // SLIDE GENERATION LOGIC (Optimized for Mac Office 2026)
    await PowerPoint.run(async (context) => {
      const slides = context.presentation.slides;
      const countResult = slides.getCount();
      await context.sync();
    
      let currentCount = countResult.value;
    
      for (const data of slidesData) {
        // Add slide without layout object to prevent 'InvalidArgument'
        slides.add(); 
        await context.sync();
    
        const newSlide = slides.getItemAt(currentCount);
        const shapes = newSlide.shapes;

        // 1. Sidebar - Set properties individually
        const sidebar = shapes.addGeometricShape(PowerPoint.GeometricShapeType.rectangle);
        sidebar.left = 0;
        sidebar.top = 0;
        sidebar.width = 12;
        sidebar.height = 540;
        sidebar.fill.setSolidColor("#2189d1");
        sidebar.lineFormat.visible = false;
    
        // 2. Title - addTextBox(text, options)
        const titleBox = shapes.addTextBox(data.title || "Untitled Slide", {
          left: 50, top: 40, width: 620, height: 60
        });
        titleBox.textFrame.textRange.font.bold = true;
        titleBox.textFrame.textRange.font.size = 32;
        titleBox.textFrame.textRange.font.color = "#2189d1";
    
        // 3. Body Bullets - addTextBox(text, options)
        const bodyText = Array.isArray(data.bullets) ? data.bullets.join("\n• ") : data.bullets;
        const bodyContent = bodyText.startsWith("•") ? bodyText : "• " + bodyText;
        const bodyBox = shapes.addTextBox(bodyContent, {
          left: 50, top: 120, width: 620, height: 300
        });
        bodyBox.textFrame.textRange.font.size = 18;
        bodyBox.textFrame.textRange.font.color = "#333333";

        // 4. AI Speaker Notes - addTextBox(text, options)
        const notesText = `💡 AI NOTES: ${data.notes || ""}`;
        const notesBox = shapes.addTextBox(notesText, {
          left: 50, top: 460, width: 620, height: 60
        });
        notesBox.textFrame.textRange.font.size = 10;
        notesBox.textFrame.textRange.font.color = "#888888";
        notesBox.textFrame.textRange.font.italic = true;
    
        currentCount++;
        // Frequent syncs prevent buffer errors on Mac
        await context.sync();
      }
      
      statusMsg.innerText = "✅ Deck Generated!";
      statusMsg.classList.remove("loading-pulse");
    });
  } catch (error) {
    console.error("FINAL ERROR:", error);
    if (error.name === "TypeError") {
      statusMsg.innerText = "Security: Right-click > Inspect > Console > Click URL.";
    } else {
      statusMsg.innerText = "Error: " + error.message;
    }
    statusMsg.classList.remove("loading-pulse");
  }
}