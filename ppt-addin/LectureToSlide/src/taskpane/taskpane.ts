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
    
        // 2. Title - Separate text assignment
        const titleBox = shapes.addTextBox();
        titleBox.textFrame.textRange.text = data.title || "Untitled Slide";
        titleBox.left = 50;
        titleBox.top = 40;
        titleBox.width = 620;
        titleBox.height = 60;
        titleBox.textFrame.textRange.font.bold = true;
        titleBox.textFrame.textRange.font.size = 32;
        titleBox.textFrame.textRange.font.color = "#2189d1";
    
        // 3. Body Bullets
        const bodyText = Array.isArray(data.bullets) ? data.bullets.join("\n• ") : data.bullets;
        const bodyBox = shapes.addTextBox();
        bodyBox.textFrame.textRange.text = bodyText.startsWith("•") ? bodyText : "• " + bodyText;
        bodyBox.left = 50;
        bodyBox.top = 120;
        bodyBox.width = 620;
        bodyBox.height = 300;
        bodyBox.textFrame.textRange.font.size = 18;
        bodyBox.textFrame.textRange.font.color = "#333333";

        // 4. AI Speaker Notes
        const notesBox = shapes.addTextBox();
        notesBox.textFrame.textRange.text = `💡 AI NOTES: ${data.notes || ""}`;
        notesBox.left = 50;
        notesBox.top = 460;
        notesBox.width = 620;
        notesBox.height = 60;
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