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
  const code = codeInput.value;

  if (!code || code.length !== 6) {
    statusMsg.innerText = "Error: Need 6 digits.";
    return;
  }

  try {
    statusMsg.innerText = "🚀 Syncing with AI...";
    
    // Using your Cloudflare tunnel URL
    const response = await fetch(`https://betty-quarter-both-rouge.trycloudflare.com/fetch-slides/${code}`);
    const slidesData = await response.json();

    if (!slidesData || slidesData.length === 0) {
      statusMsg.innerText = "No data found for this code.";
      return;
    }

    /* ... inside your shapes loop ... */
    await PowerPoint.run(async (context) => {
      const presentation = context.presentation;
      const slides = presentation.slides;
      
      // 1. Correctly handle the count
      const countResult = slides.getCount();
      
      // We don't load the countResult; we just sync the context
      await context.sync();
    
      let currentCount = countResult.value;
    
      for (const data of slidesData) {
        // 2. Add the slide
        slides.add();
        await context.sync();
    
        // 3. Grab the slide by index
        const newSlide = slides.getItemAt(currentCount);
        
        // 4. Load the shapes collection so we can add to it
        newSlide.load("shapes");
        await context.sync();
    
        const shapes = newSlide.shapes;
    
        // --- DESIGN: TITLE ---
        const titleBox = shapes.addTextBox(data.title, { 
          left: 50, 
          top: 40, 
          width: 620, 
          height: 60 
        });
        titleBox.textFrame.textRange.font.bold = true;
        titleBox.textFrame.textRange.font.size = 32;
        titleBox.textFrame.textRange.font.color = "#007AFF";
    
        // --- DESIGN: ACCENT LINE ---
        const line = shapes.addLine(PowerPoint.ConnectorType.straight, {
          left: 50,
          top: 105,
          width: 300,
          height: 0
        } as any); 
        line.lineFormat.color = "#007AFF";
        line.lineFormat.weight = 2;
    
        // --- DESIGN: BODY ---
        const fullBodyText = data.bullets.join("\n") + "\n\n" + data.notes;
        const bodyBox = shapes.addTextBox(fullBodyText, { 
          left: 50, 
          top: 130, 
          width: 620, 
          height: 350 
        });
        
        bodyBox.textFrame.textRange.font.size = 13;
        bodyBox.textFrame.textRange.font.color = "#333333";
    
        // Move to next index for next iteration
        currentCount++;
        await context.sync();
      }
    });
  } catch (error) {
    console.error(error);
    statusMsg.innerText = "Error! Check browser console.";
  }
}