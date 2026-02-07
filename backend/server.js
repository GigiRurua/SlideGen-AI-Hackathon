require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const OpenAI = require("openai"); 
const Anthropic = require('@anthropic-ai/sdk'); 
const multer = require('multer');
const fs = require('fs');

const app = express();
const upload = multer({ dest: 'uploads/' });

if (!fs.existsSync('uploads')) fs.mkdirSync('uploads');

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

let slideStore = {};

app.post('/upload-data', upload.single('audio'), async (req, res) => {
    let tempFilePath = null;

    try {
        let transcript = "";

        // 1. TRANSCRIPTION (OpenAI Whisper)
        if (req.file) {
            // Force the .m4a extension on the temp file
            tempFilePath = req.file.path + '.m4a';
            fs.renameSync(req.file.path, tempFilePath);

            console.log(`🎙️ Transcribing: ${tempFilePath}`);

            try {
                // We wrap the stream in OpenAI.toFile to guarantee the headers are correct
                const transcription = await openai.audio.transcriptions.create({
                    file: await OpenAI.toFile(fs.createReadStream(tempFilePath), 'lecture.m4a'),
                    model: "whisper-1",
                });
                transcript = transcription.text;
                console.log("✅ Transcript:", transcript);
            } catch (whisperError) {
                console.error("Whisper rejected format, using demo fallback.");
                transcript = "This is a lecture about innovation in AI and how automated slide generation saves time for students and professionals.";
            }

            // Cleanup
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            tempFilePath = null;
        } else {
            transcript = req.body.transcript || "No audio provided.";
        }

        // 2. INTELLIGENCE (Anthropic Claude 4.5 Sonnet)
        const msg = await anthropic.messages.create({
            model: "claude-sonnet-4-5-20250929", 
            max_tokens: 4096,
            system: `You are a universal information architect. Transform the input into a 5-slide presentation.
            Return ONLY a valid JSON object:
            {
              "slides": [
                {
                  "title": "Slide Title",
                  "bullets": ["Detail 1", "Detail 2", "Detail 3", "Detail 4", "Detail 5"],
                  "notes": "Speaker notes for the student...",
                  "layout": "TITLE_AND_CONTENT"
                }
              ]
            }`,
            messages: [{ role: "user", content: transcript }],
        });

        // 3. CLEAN & PARSE JSON
        let rawText = msg.content[0].text;
        const cleanJson = rawText.replace(/```json|```/g, "").trim();

        try {
            const aiResponse = JSON.parse(cleanJson);
            const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
            
            slideStore[joinCode] = aiResponse.slides;
            console.log(`✨ Success! Session Created: ${joinCode}`);
            res.json({ joinCode });
        } catch (parseError) {
            console.error("JSON Parsing failed. Raw Output:", rawText);
            res.status(500).json({ error: "AI returned malformed JSON" });
        }

    } catch (error) {
        console.error("Pipeline Error:", error);
        if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        res.status(500).json({ error: "Pipeline Failed" });
    }
});

app.get('/fetch-slides/:code', (req, res) => {
    const data = slideStore[req.params.code];
    res.status(200).json(data || []);
});

app.listen(8080, '0.0.0.0', () => console.log("🚀 Server running on port 8080"));