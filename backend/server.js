require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai"); 
const Anthropic = require('@anthropic-ai/sdk'); 
const multer = require('multer');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Ensure directory exists
if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

// --- 1. HACKATHON-PROOF CORS & EXPRESS 5 SETUP ---
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// Use the named wildcard {*splat} to fix the Express 5 PathError
app.options('/{*splat}', cors());

app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let slideStore = {};

// --- 2. UPLOAD ENDPOINT (Mobile/Web) ---
app.post('/upload-data', upload.single('audio'), async (req, res) => {
    let tempFilePath = null;
    try {
        let transcript = "";
        
        // Step 1: Transcription with Whisper
        if (req.file) {
            tempFilePath = req.file.path + '.m4a';
            fs.renameSync(req.file.path, tempFilePath);
            
            console.log(`🎙️ Transcribing: ${tempFilePath}`);
            try {
                const transcription = await openai.audio.transcriptions.create({
                    file: await OpenAI.toFile(fs.createReadStream(tempFilePath), 'lecture.m4a'),
                    model: "whisper-1",
                });
                transcript = transcription.text;
                console.log("✅ Transcript generated");
            } catch (whisperError) {
                console.error("Whisper Error:", whisperError.message);
                transcript = "Fallback: Discussion about AI innovation and slide automation.";
            }
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } else {
            transcript = req.body.transcript || "No audio provided.";
        }

        // Step 2: Generation with Claude 4.5
        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-5", 
            max_tokens: 4096,
            system: `You are a presentation expert. Return ONLY valid JSON: {"slides": [{"title": "...", "bullets": ["..."], "notes": "..."}]}`,
            messages: [{ role: "user", content: transcript }],
        });

        const rawText = msg.content[0].text;
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        const aiResponse = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
        
        const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
        slideStore[joinCode] = aiResponse.slides;
        
        console.log(`✨ Session Created: ${joinCode}`);
        res.json({ joinCode });

    } catch (error) {
        console.error("Pipeline Error:", error);
        res.status(500).json({ error: "Pipeline Failed" });
    }
});

// --- 3. FETCH ENDPOINT (PowerPoint Add-in) ---
app.get('/fetch-slides/:code', (req, res) => {
    const data = slideStore[req.params.code];
    console.log(`📥 Fetch request for code: ${req.params.code} - Found: ${!!data}`);
    
    // Explicitly send 200 even if data is missing to prevent Add-in "Connection Lost" errors
    res.status(200).json(data || []);
});

// Start Server
const PORT = 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`👉 Cloudflare Tunnel must point to: http://localhost:${PORT}`);
});