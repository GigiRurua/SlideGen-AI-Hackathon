require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

const BETA_HEADERS = [
  'code-execution-2025-08-25',
  'skills-2025-10-02',
  'files-api-2025-04-14',
];

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
if (!fs.existsSync(OUTPUTS_DIR)) fs.mkdirSync(OUTPUTS_DIR);

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.options('/{*splat}', cors());
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const slideStore = {};

function extractFileIdFromMessage(response) {
  const content = response.content || [];
  for (const block of content) {
    if (!block.content) continue;
    // code_execution_tool_result (e.g. pptx skill output)
    if (block.type === 'code_execution_tool_result') {
      const result = block.content;
      if (result.type === 'code_execution_result' && result.content && Array.isArray(result.content)) {
        for (const out of result.content) {
          if (out.type === 'code_execution_output' && out.file_id) return out.file_id;
        }
      }
    }
    // bash_code_execution_tool_result (e.g. generated files from bash/code)
    if (block.type === 'bash_code_execution_tool_result') {
      const result = block.content;
      if (result.type === 'bash_code_execution_result' && result.content && Array.isArray(result.content)) {
        for (const out of result.content) {
          if (out.type === 'bash_code_execution_output' && out.file_id) return out.file_id;
        }
      }
    }
  }
  return null;
}

app.post('/upload-data', upload.single('audio'), async (req, res) => {
  let tempFilePath = null;
  try {
    let transcript = '';

    if (req.file) {
      tempFilePath = req.file.path + '.m4a';
      fs.renameSync(req.file.path, tempFilePath);
      console.log(`🎙️ Transcribing: ${tempFilePath}`);
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: await OpenAI.toFile(fs.createReadStream(tempFilePath), 'lecture.m4a'),
          model: 'whisper-1',
        });
        transcript = transcription.text;
        console.log('✅ Transcript generated');
      } catch (whisperError) {
        console.error('Whisper Error:', whisperError.message);
        transcript = 'Fallback: Discussion about AI innovation and slide automation.';
      }
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    } else {
      transcript = req.body.transcript || 'No audio provided.';
    }

    const userPrompt = `Design a professional PowerPoint presentation based on this transcript. Include high-quality layout, relevant data tables where appropriate, and structured content. Use the pptx skill to generate the file.\n\nTranscript:\n${transcript}`;

    const messages = [{ role: 'user', content: userPrompt }];
    const createParams = {
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 8192,
      betas: BETA_HEADERS,
      container: {
        skills: [
          { type: 'anthropic', skill_id: 'pptx', version: 'latest' },
        ],
      },
      tools: [
        { type: 'code_execution_20250825', name: 'code_execution' },
      ],
      messages,
    };

    let msg = await anthropic.beta.messages.create(createParams);
    const maxTurns = 20;
    let turns = 0;
    let fileId = null;

    while (turns < maxTurns) {
      fileId = extractFileIdFromMessage(msg);
      if (fileId) break;
      if (msg.stop_reason !== 'tool_use' && msg.stop_reason !== 'pause_turn') break;

      turns++;
      messages.push({ role: 'assistant', content: msg.content });
      if (msg.container && msg.container.id) {
        createParams.container = msg.container.id;
      }
      createParams.messages = messages;
      msg = await anthropic.beta.messages.create(createParams);
    }

    if (!fileId) fileId = extractFileIdFromMessage(msg);
    if (!fileId) {
      console.error('No file_id in response after', turns + 1, 'turns. stop_reason:', msg.stop_reason);
      console.error('Raw content sample:', JSON.stringify(msg.content?.slice?.(0, 3) ?? msg.content, null, 2));
      return res.status(500).json({ error: 'Claude did not return a generated file.' });
    }

    const fileResponse = await anthropic.beta.files.download(fileId, {
      betas: ['files-api-2025-04-14'],
    });

    const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
    const filename = `presentation_${joinCode}.pptx`;
    const filePath = path.join(OUTPUTS_DIR, filename);

    const buffer = await fileResponse.arrayBuffer();
    fs.writeFileSync(filePath, Buffer.from(buffer));

    slideStore[joinCode] = { filePath, filename };
    console.log(`✨ Session created: ${joinCode} -> ${filename}`);
    res.json({ joinCode });
  } catch (error) {
    console.error('Pipeline Error:', error);
    if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    res.status(500).json({ error: 'Pipeline Failed', detail: error.message });
  }
});

app.get('/fetch-slides/:code', (req, res) => {
  const entry = slideStore[req.params.code];
  console.log(`📥 Fetch request for code: ${req.params.code} - Found: ${!!entry}`);

  if (!entry || !entry.filePath || !fs.existsSync(entry.filePath)) {
    res.status(404).json({ error: 'Not found', message: 'No presentation found for this code.' });
    return;
  }

  const filename = entry.filename || `presentation_${req.params.code}.pptx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(entry.filePath);
});

const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`👉 Cloudflare Tunnel must point to: http://localhost:${PORT}`);
});
