require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express(); // <--- THIS MUST BE FIRST
const upload = multer({ dest: 'uploads/' });

// Basic Setup
const BETA_HEADERS = ['code-execution-2025-08-25', 'skills-2025-10-02', 'files-api-2025-04-14'];
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'], credentials: true }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const slideStore = {};

// Helper to find file_id in Claude's complex response
function extractFileIdFromMessage(response) {
  const content = response.content || [];
  for (const block of content) {
    if (block.type === 'code_execution_tool_result' || block.type === 'bash_code_execution_tool_result') {
      const result = block.content;
      if (result.content && Array.isArray(result.content)) {
        for (const out of result.content) {
          if (out.file_id) return out.file_id;
        }
      }
    }
  }
  return null;
}

// 1. STATUS CHECK ENDPOINT (For polling)
app.get('/status/:code', (req, res) => {
  const entry = slideStore[req.params.code];
  if (!entry) return res.status(404).json({ error: 'Invalid code' });
  const ready = !!(entry.filePath && fs.existsSync(entry.filePath));
  res.json({ ready, status: entry.status });
});

// 2. MAIN UPLOAD ENDPOINT
app.post('/upload-data', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  try {
    let transcript = '';
    if (req.file) {
      tempFilePath = req.file.path + '.m4a';
      fs.renameSync(req.file.path, tempFilePath);
      console.log(`🎙️ Transcribing: ${tempFilePath}`);
      const transcription = await openai.audio.transcriptions.create({
        file: await OpenAI.toFile(fs.createReadStream(tempFilePath), 'lecture.m4a'),
        model: 'whisper-1',
      });
      transcript = transcription.text;
      console.log('✅ Transcript generated');
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } else {
      transcript = req.body.transcript || 'No audio provided.';
    }

    const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
    slideStore[joinCode] = { status: 'processing', transcript };
    
    // Respond immediately to the phone
    res.json({ joinCode });

    // Kick off the AI in the background
    processSlidesInBackground(joinCode, transcript);

  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Upload Failed' });
  }
});

// 3. BACKGROUND AI ENGINE
async function processSlidesInBackground(joinCode, transcript) {
  try {
    console.log(`🤖 [${joinCode}] Claude is architecting slides...`);
    const messages = [{ 
        role: 'user', 
        content: `Design a professional PowerPoint based on this transcript. Use the pptx skill. Transcript: ${transcript}` 
    }];
    
    const createParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      betas: BETA_HEADERS,
      container: { skills: [{ type: 'anthropic', skill_id: 'pptx', version: 'latest' }] },
      tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
      messages,
    };

    let msg = await anthropic.beta.messages.create(createParams);
    let turns = 0;
    let fileId = null;

    while (turns < 15) {
      fileId = extractFileIdFromMessage(msg);
      if (fileId) break;
      if (msg.stop_reason !== 'tool_use' && msg.stop_reason !== 'pause_turn') break;

      turns++;
      console.log(`🔄 [${joinCode}] Turn ${turns}: Claude is running code...`);
      messages.push({ role: 'assistant', content: msg.content });
      if (msg.container?.id) createParams.container = { id: msg.container.id };
      createParams.messages = messages;
      msg = await anthropic.beta.messages.create(createParams);
    }

    if (fileId) {
      const fileResponse = await anthropic.beta.files.download(fileId, { betas: ['files-api-2025-04-14'] });
      const filename = `presentation_${joinCode}.pptx`;
      const filePath = path.join(OUTPUTS_DIR, filename);
      const buffer = await fileResponse.arrayBuffer();
      fs.writeFileSync(filePath, Buffer.from(buffer));
      
      slideStore[joinCode].filePath = filePath;
      slideStore[joinCode].filename = filename;
      slideStore[joinCode].status = 'ready';
      console.log(`✨ [${joinCode}] Slides Ready!`);
    }
  } catch (err) {
    console.error(`❌ [${joinCode}] AI Loop Failed:`, err);
  }
}

// 4. DOWNLOAD ENDPOINT
app.get('/fetch-slides/:code', (req, res) => {
  const entry = slideStore[req.params.code];
  if (!entry || !entry.filePath || !fs.existsSync(entry.filePath)) {
    return res.status(404).json({ error: 'Not ready' });
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.sendFile(entry.filePath);
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});