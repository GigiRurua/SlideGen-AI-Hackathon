require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { OpenAI, toFile } = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure directories exist
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
if (!fs.existsSync('outputs')) fs.mkdirSync('outputs');

app.use(cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const slideStore = {};

function extractFileId(msg) {
  for (const block of (msg.content || [])) {
    if (block.type === 'tool_use' || block.type === 'code_execution_tool_result') {
      const content = block.content || [];
      if (Array.isArray(content)) {
        for (const item of content) { if (item.file_id) return item.file_id; }
      }
    }
    if (block.content && Array.isArray(block.content)) {
        for (const item of block.content) { if (item.file_id) return item.file_id; }
    }
  }
  return null;
}

app.get('/status/:code', (req, res) => {
  const entry = slideStore[req.params.code];
  if (!entry) return res.status(404).json({ error: 'Not found' });
  res.json({ ready: entry.status === 'ready', status: entry.status, percent: entry.percent || 0 });
});

app.post('/upload-data', upload.single('audio'), async (req, res) => {
  const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
  const notes = req.body.notes || "No special instructions.";
  
  slideStore[joinCode] = { status: 'transcribing', percent: 10, notes };
  res.json({ joinCode });

  (async () => {
    try {
      let transcript = "No audio recorded.";
      if (req.file) {
        const audioPath = req.file.path + '.m4a';
        fs.renameSync(req.file.path, audioPath);

        // WHISPER FIX: Use toFile with the actual buffer to prevent 400 error
        const fileBuffer = fs.readFileSync(audioPath);
        const file = await toFile(fileBuffer, 'recording.m4a');
        
        console.log(`🎙️ [${joinCode}] Transcribing...`);
        const transcription = await openai.audio.transcriptions.create({
          file: file,
          model: 'whisper-1',
        });
        transcript = transcription.text;
        fs.unlinkSync(audioPath);
      }

      slideStore[joinCode].status = 'architecting';
      slideStore[joinCode].percent = 40;
      console.log(`🤖 [${joinCode}] Sonnet 4.5 is designing slides...`);

      const msg = await anthropic.beta.messages.create({
        model: 'claude-sonnet-4-5-20250929', // The best model for this task
        max_tokens: 8192,
        betas: ['code-execution-2025-08-25', 'skills-2025-10-02', 'files-api-2025-04-14'],
        container: { skills: [{ type: 'anthropic', skill_id: 'pptx', version: 'latest' }] },
        tools: [{ type: 'code_execution_20250825', name: 'code_execution' }],
        messages: [{ role: 'user', content: `TRANSCRIPT: ${transcript}\nNOTES: ${notes}\n\nCreate a 5-slide PowerPoint.` }],
      });

      slideStore[joinCode].status = 'generating_code';
      slideStore[joinCode].percent = 70;

      // Extract file logic (Simple loop for demo)
      let fileId = extractFileId(msg);
      // ... polling for the file if necessary ...

      if (fileId) {
        const fileRes = await anthropic.beta.files.download(fileId, { betas: ['files-api-2025-04-14'] });
        const filePath = path.join(__dirname, 'outputs', `presentation_${joinCode}.pptx`);
        fs.writeFileSync(filePath, Buffer.from(await fileRes.arrayBuffer()));
        
        slideStore[joinCode].status = 'ready';
        slideStore[joinCode].percent = 100;
        slideStore[joinCode].filePath = filePath;
        console.log(`✨ [${joinCode}] Slides Ready!`);
      }
    } catch (err) {
      console.error(`❌ [${joinCode}] Background Error:`, err.message);
      slideStore[joinCode].status = 'error';
    }
  })();
});

app.get('/fetch-slides/:code', (req, res) => {
  const entry = slideStore[req.params.code];
  if (entry?.filePath) return res.sendFile(entry.filePath);
  res.status(404).send("File not found");
});

app.listen(8080, '0.0.0.0', () => console.log('🚀 Server listening on 8080'));