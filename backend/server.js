require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Log startup info for debugging
console.log("Starting server in environment:", process.env.NODE_ENV || 'development');
console.log("Puppeteer path override:", process.env.PUPPETEER_EXECUTABLE_PATH || 'Not set');

// Environment-based config
const PORT = process.env.PORT || 3000;

// Supabase configuration
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

let supabase;
if (supabaseUrl && supabaseKey) {
    try {
        supabase = createClient(supabaseUrl, supabaseKey);
        console.log("Supabase client initialized.");
    } catch (err) {
        console.error("Failed to initialize Supabase:", err.message);
    }
} else {
    console.warn("⚠️ WARNING: SUPABASE_URL or SUPABASE_KEY is missing. Database sync will be disabled.");
    // Mock the supabase client to avoid crashes if it's used later
    supabase = {
        from: () => ({
            insert: () => Promise.resolve({ error: null }),
            upsert: () => Promise.resolve({ error: null }),
            delete: () => ({ match: () => Promise.resolve({ error: null }) }),
            select: () => Promise.resolve({ data: [], error: null })
        })
    };
}

// Catch unhandled exceptions to prevent crash 
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

// OpenAI Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const http = require('http');
const { Server } = require('socket.io');
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Ensure uploads folder exists
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads');
}

// Database setup
const dbPath = path.join(__dirname, 'trips.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupName TEXT,
    chatId TEXT,
    msgId TEXT,
    sender TEXT,
    senderName TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS confirmed_trips (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    groupName TEXT,
    chatId TEXT,
    msgId TEXT,
    sender TEXT,
    senderName TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    details TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS avoid_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE
  )`);
  
  // Initial keywords
  const initialKeywords = ['trip', 'pickup', 'drop', 'taxi', 'ride', 'cab', 'airport', 'outstation', 'duty', 'available', 'pick', 'drop', 'booking', 'needed', 'requirements', 'avvialbe'];
  const initialAvoidKeywords = ['status', 'group', 'join', 'rules', 'admin', 'payment', 'paid'];
  
  const stmt = db.prepare('INSERT OR IGNORE INTO keywords (word) VALUES (?)');
  initialKeywords.forEach(word => stmt.run(word));
  stmt.finalize();

  const stmtAvoid = db.prepare('INSERT OR IGNORE INTO avoid_keywords (word) VALUES (?)');
  initialAvoidKeywords.forEach(word => stmtAvoid.run(word));
  stmtAvoid.finalize();

  // Monitored chats table
  db.run(`CREATE TABLE IF NOT EXISTS monitored_chats (
    id TEXT PRIMARY KEY,
    name TEXT,
    isGroup INTEGER
  )`);

  // Ensure all necessary columns exist
  const tables = ['trips', 'confirmed_trips'];
  const columns = [
    { name: 'perKm', type: 'TEXT' },
    { name: 'bata', type: 'TEXT' },
    { name: 'commission', type: 'TEXT' },
    { name: 'toll', type: 'TEXT' },
    { name: 'customerName', type: 'TEXT' },
    { name: 'customerMobile', type: 'TEXT' },
    { name: 'trip_date', type: 'TEXT' },
    { name: 'trip_time', type: 'TEXT' },
    { name: 'mediaUrl', type: 'TEXT' },
    { name: 'transcription', type: 'TEXT' }
  ];

  tables.forEach(table => {
    columns.forEach(col => {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${col.name} ${col.type}`, (err) => {
        // Silently fail if column already exists
      });
    });
  });
});

let client;

function initializeClient() {
    const puppeteerOptions = {
        headless: true,
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
        puppeteerOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    client = new Client({
        authStrategy: new LocalAuth({ clientId: "client-one" }),
        puppeteer: puppeteerOptions
    });

    function broadcastStatus(status) {
        connectionStatus = status;
        io.emit('status', status);
    }

    client.on('qr', (qr) => {
        qrcode.toDataURL(qr, (err, url) => {
            currentQr = url;
            broadcastStatus("Waiting for Scan");
            console.log('New QR Received');
        });
    });

    client.on('ready', () => {
        console.log('WhatsApp Client is ready!');
        broadcastStatus("Connected");
        currentQr = "";
    });

    client.on('authenticated', () => {
        console.log('Authenticated');
    });

    client.on('auth_failure', () => {
        console.error('Auth failure');
        connectionStatus = "Auth Failed";
    });

function normalizeText(text) {
    if (!text) return "";
    // Normalize to handle some accents/diacritics
    let normalized = text.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
    
    // Map Mathematical Alphanumeric Symbols to standard ASCII
    // This is a partial map for common WhatsApp style-bold/italic/serif characters
    const ranges = [
        [0x1D400, 65, 26], // Bold A-Z
        [0x1D41A, 97, 26], // Bold a-z
        [0x1D434, 65, 26], // Italic A-Z
        [0x1D44E, 97, 26], // Italic a-z
        [0x1D468, 65, 26], // Bold Italic A-Z
        [0x1D482, 97, 26], // Bold Italic a-z
        [0x1D4D0, 65, 26], // Script A-Z
        [0x1D4EA, 97, 26], // Script a-z
        [0x1D504, 65, 26], // Fraktur A-Z
        [0x1D51E, 97, 26], // Fraktur a-z
        [0x1D538, 65, 26], // Double-struck A-Z
        [0x1D552, 97, 26], // Double-struck a-z
        [0x1D56C, 65, 26], // Bold Fraktur A-Z
        [0x1D586, 97, 26], // Bold Fraktur a-z
        [0x1D5A0, 65, 26], // Sans-serif A-Z
        [0x1D5BA, 97, 26], // Sans-serif a-z
        [0x1D5D4, 65, 26], // Sans-serif Bold A-Z
        [0x1D5EE, 97, 26], // Sans-serif Bold a-z
        [0x1D608, 65, 26], // Sans-serif Italic A-Z
        [0x1D622, 97, 26], // Sans-serif Italic a-z
        [0x1D63C, 65, 26], // Sans-serif Bold Italic A-Z
        [0x1D656, 97, 26], // Sans-serif Bold Italic a-z
        [0x1D670, 65, 26], // Monospace A-Z
        [0x1D68A, 97, 26]  // Monospace a-z
    ];

    for (const [start, asciiStart, count] of ranges) {
        for (let i = 0; i < count; i++) {
            const charCode = start + i;
            const asciiChar = String.fromCharCode(asciiStart + i);
            const regex = new RegExp(String.fromCodePoint(charCode), 'g');
            normalized = normalized.replace(regex, asciiChar);
        }
    }

    return normalized;
}

function cleanLocation(loc) {
    if (!loc) return "";
    // Remove emojis and special characters
    let clean = loc.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}]/gu, '');
    // Remove specific keywords but preserve city names
    clean = clean.replace(/\b(IMMEDIATE|PICKUP|DROP|NEAR|AT|NOW|TODAY|TOMORROW|ANY|TO|FROM)\b/gi, '').trim();
    // Remove extra spaces and punctuation at ends
    return clean.replace(/^[:\-,\s]+|[:\-,\s]+$/g, '').trim();
}

// Transcription helper
async function transcribeAudio(filePath) {
    if (!OPENAI_API_KEY) {
        console.warn("OpenAI API Key not set. Skipping transcription.");
        return null;
    }
    
    try {
        console.log("Transcribing audio:", filePath);
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: "whisper-1",
        });
        return transcription.text;
    } catch (error) {
        console.error("Transcription Error:", error.message);
        return null;
    }
}

function extractTripDetails(text) {
    const details = {
        pickup: "",
        drop: "",
        vehicle: "",
        date: "",
        time: "",
        tariff: "",
        commission: "",
        toll: "",
        customerName: "",
        customerMobile: "",
        tripType: "One Way",
        perKm: "",
        bata: ""
    };

    const textLower = text.toLowerCase();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    
    // 1. Detect Trip Type
    if (textLower.includes('round') || textLower.includes('two way') || textLower.includes('drop & pickup')) {
        details.tripType = "Two Way";
    }

    // 2. Advanced Location Detection
    // Try to find a line with " TO " first as it's most reliable
    const toLine = lines.find(line => line.toUpperCase().includes(' TO '));
    if (toLine) {
        const parts = toLine.split(/ TO /i);
        details.pickup = cleanLocation(parts[0]);
        details.drop = cleanLocation(parts[1]);
    } else {
        // Fallback to PICK/DROP pattern
        const pickDropMatch = text.match(/PICK\s*[:\-]?\s*(.+)\s+DROP\s*[:\-]?\s*(.+)/i);
        if (pickDropMatch) {
            details.pickup = cleanLocation(pickDropMatch[1].split('\n')[0]);
            details.drop = cleanLocation(pickDropMatch[2].split('\n')[0]);
        }
    }

    // 3. Detect Vehicle
    const vehicles = ['Ertiga', 'Innova', 'Etios', 'Swift', 'Dzire', 'Xylo', 'Crysta', 'Traveler', 'Cruiser', 'XUV', 'SUV', 'SEDAN'];
    for (const v of vehicles) {
        if (textLower.includes(v.toLowerCase())) {
            details.vehicle = v;
            break;
        }
    }

    // 4. Detect Date/Time
    if (textLower.includes('immediate')) details.time = "IMMEDIATE";
    
    const timeMatch = text.match(/(\d{1,2}[:.]?\d{0,2}\s*(am|pm|o'clock))/i) || text.match(/(\d{1,2}:\d{2})/);
    if (timeMatch) details.time = timeMatch[0];

    const dateMatch = text.match(/(\d{1,2}\s*(th|st|nd|rd|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))/i) || text.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/);
    if (dateMatch) details.date = dateMatch[0];

    // 5. Detect Tariff/Amount
    const amountMatch = text.match(/(\d+)\s*[/]\s*(\d+)/); 
    if (amountMatch) {
        details.perKm = amountMatch[1];
        details.bata = amountMatch[2];
        details.tariff = `${amountMatch[1]} / ${amountMatch[2]}`;
    } else {
        const simpleAmount = text.match(/(\d{4,5})/); // Look for 4-5 digit numbers as fixed fare
        if (simpleAmount) details.tariff = simpleAmount[0];
    }

    // 6. Detect Commission (e.g., 10%CC, 10CC, 100 COM)
    const commMatch = text.match(/(\d+)\s*(?:%?\s*(?:cc|com|commission))/i);
    if (commMatch) {
        details.commission = commMatch[1] + (text.includes('%') ? '%' : '');
    }

    // 7. Detect Toll/Permit
    if (textLower.includes('toll')) {
        if (textLower.includes('extra')) details.toll = "Extra";
        else details.toll = "Included";
    }

    // 8. Detect Customer Name and Mobile
    const mobileMatch = text.match(/([6-9]\d{9})/); // Simple 10-digit Indian mobile
    if (mobileMatch) {
        details.customerMobile = mobileMatch[1];
        // Name usually appears on the same line or line before the mobile number
        const mobileLineIndex = lines.findIndex(l => l.includes(mobileMatch[1]));
        if (mobileLineIndex !== -1) {
            const line = lines[mobileLineIndex];
            const namePart = line.replace(mobileMatch[1], '').replace(/[:\-]/g, '').trim();
            if (namePart.length > 3) {
                details.customerName = namePart;
            } else if (mobileLineIndex > 0) {
                const prevLine = lines[mobileLineIndex - 1];
                // Check if prev line is likely a name (not a location or vehicle)
                if (prevLine.length < 30 && !prevLine.includes(' TO ') && !prevLine.includes('PICKUP')) {
                    details.customerName = prevLine;
                }
            }
        }
    }

    return JSON.stringify(details);
}

client.on('message', async (message) => {
    let text = message.body || "";
    
    // 0. Handle Media (Voice Messages / Images)
    let mediaUrl = "";
    let transcriptionText = "";

    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            const ext = media.mimetype.split('/')[1].split(';')[0];
            const filename = `${message.id._serialized}_${Date.now()}.${ext}`;
            const filePath = path.join(__dirname, 'uploads', filename);
            fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
            mediaUrl = `/uploads/${filename}`;
            
            if (media.mimetype.includes('audio')) { // Check for audio type
                transcriptionText = await transcribeAudio(filePath);
                if (transcriptionText) {
                    console.log("Voice Transcription:", transcriptionText);
                    text = "[Voice Message] " + transcriptionText; // Update message body with transcription
                } else {
                    text = "[Voice Message]";
                }
            } else if (message.type === 'image') {
                text = "[Image] " + (text || "");
            }
        } catch (e) {
            console.error("Media Download Error:", e.message);
        }
    }

    const textLower = normalizeText(text).toLowerCase();
    
    console.log(`Processing message from ${message.from}: ${text.substring(0, 50)}...`);

    // MONITOR EVERYTHING BY DEFAULT (MODIFIED)
    // We'll skip the chatSelectionCheck and prioritize all messages
    const chatSelectionCheck = true;

    if (!chatSelectionCheck) {
        console.log(`Skipping unmonitored chat: ${message.from}`);
        return;
    }

    // 1. Check if it's a "PASS" / "PP" / "Duty Pass" / "Moved" reply
    const passKeywords = ['pp', 'pass', 'duty pass', 'trip pass', 'dp', 'trip moved', 'moved', 'closed', 'taken', 'trip done', 'duty done'];
    if (message.hasQuotedMsg && passKeywords.some(kw => textLower.includes(kw))) {
        try {
            const quotedMsg = await message.getQuotedMessage();
            if (quotedMsg) {
                const quotedId = quotedMsg.id._serialized;
                console.log(`Detected cancellation/pass for message: ${quotedId}`);
                
                // Remove from both tables by msgId (most reliable)
                db.run('DELETE FROM trips WHERE msgId = ?', [quotedId]);
                db.run('DELETE FROM confirmed_trips WHERE msgId = ?', [quotedId]);
                
                console.log("Trip removed via automated detection (Moved/Passed).");
                
                // Broadcast for real-time removal
                io.emit('trip_removed', { msgId: quotedId });
                
                return; 
            }
        } catch (err) {
            console.error("Error handling quoted message for removal:", err);
        }
    }
    
    db.all('SELECT word FROM keywords', [], async (err, matchRows) => {
        if (err) return console.error(err);
        const matchKeywords = matchRows.map(r => normalizeText(r.word).toLowerCase());
        
        db.all('SELECT word FROM avoid_keywords', [], async (err, avoidRows) => {
            if (err) return console.error(err);
            const avoidKeywords = avoidRows.map(r => normalizeText(r.word).toLowerCase());

            const isMatch = matchKeywords.some(kw => textLower.includes(kw));
            const isAvoid = avoidKeywords.some(kw => textLower.includes(kw));
            
            // Special handling for voice messages: if it's a voice message from a monitored group, 
            // we might want to show it even if keywords aren't perfectly matched yet,
            // or at least be more lenient. For now, we'll stick to keywords but with the expanded list.
            const isVoiceMatch = (message.type === 'ptt' || message.type === 'audio') && (textLower.includes('duty') || textLower.includes('voice') || textLower.includes('available'));
            
            if ((isMatch || isVoiceMatch) && !isAvoid) {
                let groupName = "Private Chat";
                try {
                    const chat = await message.getChat();
                    if (chat) {
                        groupName = chat.isGroup ? chat.name : (chat.isChannel ? "Channel" : "Private Chat");
                    }
                } catch (chatError) {
                    console.error("Error getting chat info:", chatError);
                }
                
                const senderIdRaw = message.author || message.from;
                const contact = await message.getContact();
                
                // Prioritize actual phone number if available in contact info
                // contact.number is often the real phone even if JID is @lid
                let cleanSender = contact.number || senderIdRaw.replace('@c.us', '').replace('@g.us', '').replace('@lid', '').split(':')[0];
                cleanSender = cleanSender.replace(/[^0-9]/g, '');

                console.log(`Raw Sender ID: ${senderIdRaw}, Contact Number: ${contact.number}, Cleaned: ${cleanSender}`);
                
                const senderName = contact.pushname || contact.name || contact.shortName || "User";
                const extractedDetails = extractTripDetails(text); // Use the potentially updated text
                const extracted = JSON.parse(extractedDetails);
                
                const tripData = {
                    groupName: groupName,
                    chatId: message.from,
                    msgId: message.id._serialized,
                    sender: cleanSender,
                    senderName: senderName,
                    message: text, // Use the potentially updated text (with [Voice Message])
                    details: extractedDetails,
                    timestamp: new Date().toISOString(),
                    perKm: extracted.perKm || null,
                    bata: extracted.bata || null,
                    commission: extracted.commission || null,
                    toll: extracted.toll || null,
                    customerName: extracted.customerName || null,
                    customerMobile: extracted.customerMobile || null,
                    trip_date: extracted.date || null,
                    trip_time: extracted.time || null,
                    mediaUrl: mediaUrl,
                    transcription: transcriptionText // Add transcription here
                };
                
                console.log(`Detected trip message in ${groupName} from ${senderName} (${cleanSender})`);
                
                // 1. Insert into Local SQLite
                db.run('INSERT INTO trips (groupName, chatId, msgId, sender, senderName, message, details, perKm, bata, commission, toll, customerName, customerMobile, trip_date, trip_time, timestamp, mediaUrl, transcription) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [
                        tripData.groupName, tripData.chatId, tripData.msgId, tripData.sender, tripData.senderName, tripData.message, tripData.details, 
                        tripData.perKm, tripData.bata, tripData.commission, tripData.toll, 
                        tripData.customerName, tripData.customerMobile, 
                        tripData.trip_date, tripData.trip_time,
                        tripData.timestamp, tripData.mediaUrl, tripData.transcription
                    ], 
                     function(err) {
                        if (err) {
                            console.error("DB Insert Error:", err);
                        } else {
                            // Emit to real-time dashboard with the newly created ID
                            const finalTripData = { ...tripData, id: this.lastID };
                            io.emit('trip', finalTripData);
                        }
                    }
                );

                // 2. Insert into Supabase
                supabase.from('whatsapp_trips').insert([tripData]).then(({ error }) => {
                    if (error) console.error("Supabase Error:", error.message);
                    else console.log("Synced to Supabase successfully.");
                });
            }
        });
    });
});

client.initialize();
}

let currentQr = "";
let connectionStatus = "Disconnected";
let isResetting = false;

async function safeInitialize() {
    if (isResetting) return;
    try {
        isResetting = true;
        await initializeClient();
    } catch (e) {
        console.error("Initialization Failed:", e);
    } finally {
        isResetting = false;
    }
}

safeInitialize();

// API Endpoints
app.get('/qr', (req, res) => {
    // Force status sync if client was ready before first poll
    if (client && client.info && connectionStatus === 'Disconnected') {
        connectionStatus = 'Connected';
    }
    console.log(`[QR POLLED] Status: ${connectionStatus}, QR: ${currentQr ? 'YES' : 'NO'}`);
    res.json({ qr: currentQr, status: connectionStatus });
});

app.post('/reset', async (req, res) => {
    if (isResetting) {
        return res.status(429).json({ error: "Reset already in progress" });
    }
    
    console.log('Resetting WhatsApp Client...');
    isResetting = true;
    
    try {
        if (client) {
            try {
                await client.destroy();
            } catch (destroyError) {
                console.error("Error destroying client:", destroyError);
            }
        }
        
        connectionStatus = "Disconnected";
        currentQr = "";
        
        // Give it 3 seconds to clear locks
        setTimeout(async () => {
            try {
                await initializeClient();
                res.json({ success: true, message: "Client re-initialized" });
            } catch (initErr) {
                console.error("Re-initialization error:", initErr);
                res.status(500).json({ error: initErr.message });
            } finally {
                isResetting = false;
            }
        }, 3000);
        
    } catch (e) {
        isResetting = false;
        console.error('Reset Error:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/status', (req, res) => {
    res.json({ 
        status: connectionStatus,
        authenticated: client?.authenticated || false,
        ready: client?.info ? true : false
    });
});

app.get('/profile', async (req, res) => {
    if (connectionStatus !== 'Connected' || !client || !client.info) {
        return res.status(401).json({ error: 'Not connected' });
    }
    try {
        const info = client.info;
        let profilePicUrl = "";
        try {
            profilePicUrl = await client.getProfilePicUrl(info.wid._serialized);
        } catch (pfpErr) {
            console.log("Could not fetch profile pic");
        }
        res.json({
            name: info.pushname || 'User',
            number: info.wid.user,
            picture: profilePicUrl
        });
    } catch (e) {
        console.error("Profile Fetch Error:", e);
        res.status(500).json({ error: "Failed to fetch profile info" });
    }
});

app.get('/chats', async (req, res) => {
    if (connectionStatus !== 'Connected') return res.status(401).json({ error: 'Not connected' });
    try {
        const chats = await client.getChats();
        // Increased limit to show more chats (Contacts and Groups)
        const simplifiedChats = await Promise.all(chats.slice(0, 150).map(async (c) => {
            let lastMsg = "";
            let pfp = "";
            try {
                const msgs = await c.fetchMessages({ limit: 1 });
                lastMsg = msgs[0]?.body || "";
                pfp = await client.getProfilePicUrl(c.id._serialized).catch(() => "");
            } catch (e) {}
            
            return {
                id: c.id._serialized,
                name: c.name,
                unreadCount: c.unreadCount,
                timestamp: c.timestamp,
                lastMessage: lastMsg,
                isGroup: c.isGroup,
                picture: pfp
            };
        }));
        res.json(simplifiedChats);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/chats/:id/read', async (req, res) => {
    if (connectionStatus !== 'Connected') return res.status(401).json({ error: 'Not connected' });
    try {
        const chat = await client.getChatById(req.params.id);
        await chat.sendSeen();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/chats/:id/messages', async (req, res) => {
    if (connectionStatus !== 'Connected') return res.status(401).json({ error: 'Not connected' });
    try {
        const chat = await client.getChatById(req.params.id);
        const msgs = await chat.fetchMessages({ limit: 40 });
        res.json(msgs.map(m => ({
            id: m.id._serialized,
            body: m.body,
            fromMe: m.fromMe,
            timestamp: m.timestamp,
            senderName: m.author || m.from,
            type: m.type,
            hasMedia: m.hasMedia
        })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});
app.get('/messages/:id/media', async (req, res) => {
    if (connectionStatus !== 'Connected') return res.status(401).json({ error: 'Not connected' });
    try {
        const msg = await client.getMessageById(req.params.id);
        if (msg && msg.hasMedia) {
            const media = await msg.downloadMedia();
            if (media) {
                const buffer = Buffer.from(media.data, 'base64');
                res.setHeader('Content-Type', media.mimetype);
                if (media.filename) {
                    res.setHeader('Content-Disposition', `attachment; filename="${media.filename}"`);
                }
                return res.send(buffer);
            }
        }
        res.status(404).json({ error: "Media not found" });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/chats/send', async (req, res) => {
    if (connectionStatus !== 'Connected') return res.status(401).json({ error: 'Not connected' });
    const { chatId, message } = req.body;
    try {
        await client.sendMessage(chatId, message);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Monitored Chats Endpoints
app.get('/monitored-chats', (req, res) => {
    db.all('SELECT * FROM monitored_chats', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/monitored-chats', (req, res) => {
    const { id, name, isGroup } = req.body;
    if (!id) return res.status(400).json({ error: "Chat ID required" });
    
    db.run('INSERT OR IGNORE INTO monitored_chats (id, name, isGroup) VALUES (?, ?, ?)', [id, name, isGroup ? 1 : 0], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/monitored-chats/:id', (req, res) => {
    db.run('DELETE FROM monitored_chats WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/trips', (req, res) => {
    db.all('SELECT * FROM trips ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/trips/bulk-delete', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid IDs" });
    const placeholders = ids.map(() => '?').join(',');
    db.run(`DELETE FROM trips WHERE id IN (${placeholders})`, ids, (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/trips/:id/confirm', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM trips WHERE id = ?', [id], (err, trip) => {
        if (err || !trip) return res.status(404).json({ error: "Trip not found" });
        
        db.run('INSERT INTO confirmed_trips (groupName, chatId, sender, senderName, message, details, perKm, bata, commission, toll, customerName, customerMobile, trip_date, trip_time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                trip.groupName, trip.chatId, trip.sender, trip.senderName, trip.message, trip.details, 
                trip.perKm, trip.bata, trip.commission, trip.toll, 
                trip.customerName, trip.customerMobile, 
                trip.trip_date, trip.trip_time,
                trip.timestamp
            ], (insErr) => {
                if (insErr) return res.status(500).json({ error: insErr.message });
                db.run('DELETE FROM trips WHERE id = ?', [id], (delErr) => {
                    res.json({ success: true });
                });
            });
    });
});

app.post('/trips/bulk-confirm', (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: "Invalid IDs" });
    const placeholders = ids.map(() => '?').join(',');
    
    db.all(`SELECT * FROM trips WHERE id IN (${placeholders})`, ids, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        rows.forEach(trip => {
            db.run('INSERT INTO confirmed_trips (groupName, chatId, sender, senderName, message, details, perKm, bata, commission, toll, customerName, customerMobile, trip_date, trip_time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    trip.groupName, trip.chatId, trip.sender, trip.senderName, trip.message, trip.details, 
                    trip.perKm, trip.bata, trip.commission, trip.toll, 
                    trip.customerName, trip.customerMobile, 
                    trip.trip_date, trip.trip_time,
                    trip.timestamp
                ]);
        });
        
        db.run(`DELETE FROM trips WHERE id IN (${placeholders})`, ids, (delErr) => {
            res.json({ success: true });
        });
    });
});

app.get('/confirmed-trips', (req, res) => {
    db.all('SELECT * FROM confirmed_trips ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/confirmed-trips/:id/pass', async (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM confirmed_trips WHERE id = ?', [id], async (err, trip) => {
        if (err || !trip) return res.status(404).json({ error: "Confirmed trip not found" });
        try {
            if (trip.chatId) {
                const options = trip.msgId ? { quotedMessageId: trip.msgId } : {};
                await client.sendMessage(trip.chatId, "PP", options);
            }
            db.run('DELETE FROM confirmed_trips WHERE id = ?', [id], (updErr) => {
                if (updErr) return res.status(500).json({ error: updErr.message });
                res.json({ success: true, message: "Trip removed and PP sent" });
            });
        } catch (e) {
            console.error("Pass Trip Error:", e);
            res.status(500).json({ error: e.message });
        }
    });
});

app.delete('/confirmed-trips/:id', (req, res) => {
    const id = req.params.id;
    db.run('DELETE FROM confirmed_trips WHERE id = ?', [id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.delete('/confirmed-trips', (req, res) => {
    db.run('DELETE FROM confirmed_trips', [], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.post('/confirmed-trips/:id/move', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM confirmed_trips WHERE id = ?', [id], async (err, trip) => {
        if (err || !trip) return res.status(404).json({ error: "Confirmed trip not found" });
        
        // Push to main 'trips' table in Supabase for management
        let extracted = {};
        try { extracted = JSON.parse(trip.details); } catch(e) {}
        
        const managementTrip = {
            pickup_location: extracted.pickup || "Manual Entry",
            drop_location: extracted.drop || "Manual Entry",
            vehicle_type: extracted.vehicle || "Any",
            trip_date: extracted.date || new Date().toISOString().split('T')[0],
            trip_time: extracted.time || "TBD",
            commission: extracted.commission || null,
            toll: extracted.toll || null,
            customer_name: extracted.customerName || null,
            customer_mobile: extracted.customerMobile || null,
            total_amount: extracted.perKm ? `${extracted.perKm} Per Km / ${extracted.bata} Bata` : (extracted.tariff || "0"),
            trip_type: extracted.tripType || "One Way",
            status: 'open',
            notes: `WhatsApp Request: ${trip.message}`,
            created_by_source: 'whatsapp-detector'
        };
        
        const { error: supError } = await supabase.from('trips').insert([managementTrip]);
        if (supError) {
            console.error("Management Sync Error:", supError.message);
            return res.status(500).json({ error: supError.message });
        }
        
        // Remove from locally confirmed list
        db.run('DELETE FROM confirmed_trips WHERE id = ?', [id]);
        res.json({ success: true, message: "Moved to management table" });
    });
});

app.post('/trips/:id/confirm', (req, res) => {
    const id = req.params.id;
    db.get('SELECT * FROM trips WHERE id = ?', [id], async (err, trip) => {
        if (err || !trip) return res.status(404).json({ error: "Trip not found" });
        
        // 1. Local SQLite confirmed_trips
        db.run('INSERT INTO confirmed_trips (groupName, chatId, msgId, sender, senderName, message, details, perKm, bata, commission, toll, customerName, customerMobile, trip_date, trip_time, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
                trip.groupName, trip.chatId, trip.msgId, trip.sender, trip.senderName, trip.message, trip.details, 
                trip.perKm, trip.bata, trip.commission, trip.toll, 
                trip.customerName, trip.customerMobile, 
                trip.trip_date, trip.trip_time,
                trip.timestamp
            ],
            async (err) => {
                if (err) return res.status(500).json({ error: err.message });
                
                // 2. Supabase Sync (Main trips table for driver app)
                let extracted = {};
                try { extracted = JSON.parse(trip.details); } catch(e) {}
                
                const supabaseTrip = {
                    from_location: extracted.pickup || "",
                    to_location: extracted.drop || "",
                    trip_type: extracted.vehicle ? extracted.vehicle : "Taxi",
                    pickup_date: extracted.date || null,
                    pickup_time: extracted.time || "Immediate",
                    commission: extracted.commission || null,
                    toll: extracted.toll || null,
                    customer_name: extracted.customerName || null,
                    customer_mobile: extracted.customerMobile || null,
                    status: 'open',
                    notes: `From WhatsApp: ${trip.message}`,
                    created_by_source: 'whatsapp-detector'
                };
                
                const { error: supError } = await supabase.from('my_trips').insert([supabaseTrip]);
                if (supError) console.error("Confirmed Trip Supabase Error:", supError.message);

                // 3. Cleanup local detection
                db.run('DELETE FROM trips WHERE id = ?', [id]);
                res.json({ success: true });
            }
        );
    });
});

app.delete('/trips', (req, res) => {
    db.run('DELETE FROM trips', [], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

app.get('/keywords', (req, res) => {
    db.all('SELECT word FROM keywords', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.word));
    });
});

app.post('/keywords', (req, res) => {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "Word required" });
    const lowWord = word.toLowerCase();
    
    db.run('INSERT OR IGNORE INTO keywords (word) VALUES (?)', [lowWord], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Sync to Supabase
        await supabase.from('whatsapp_keywords').upsert({ word: lowWord, type: 'match' });
        res.json({ success: true });
    });
});

app.delete('/keywords/:word', (req, res) => {
    const word = req.params.word;
    db.run('DELETE FROM keywords WHERE word = ?', [word], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Remove from Supabase
        await supabase.from('whatsapp_keywords').delete().match({ word: word, type: 'match' });
        res.json({ success: true });
    });
});

// Avoid Keywords API
app.get('/avoid-keywords', (req, res) => {
    db.all('SELECT word FROM avoid_keywords', [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(r => r.word));
    });
});

app.post('/avoid-keywords', (req, res) => {
    const { word } = req.body;
    if (!word) return res.status(400).json({ error: "Word required" });
    const lowWord = word.toLowerCase();
    
    db.run('INSERT OR IGNORE INTO avoid_keywords (word) VALUES (?)', [lowWord], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Sync to Supabase
        await supabase.from('whatsapp_keywords').upsert({ word: lowWord, type: 'avoid' });
        res.json({ success: true });
    });
});

app.delete('/avoid-keywords/:word', (req, res) => {
    const word = req.params.word;
    db.run('DELETE FROM avoid_keywords WHERE word = ?', [word], async (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Remove from Supabase
        await supabase.from('whatsapp_keywords').delete().match({ word: word, type: 'avoid' });
        res.json({ success: true });
    });
});

// --- Static Frontend Serving ---
// This allows the backend to serve the web application as well.
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
    console.log("Found static frontend at", distPath);
    app.use(express.static(distPath));
    
    // For any other route, serve the index.html from dist
    // (This is for React Navigation / Single Page App support)
    app.get(/.*/, (req, res, next) => {
        // Skip API routes manually if they were not matched yet
        const apiPrefixes = ['/qr', '/status', '/profile', '/chats', '/messages', '/monitored-chats', '/trips', '/keywords', '/avoid-keywords', '/reset', '/uploads'];
        if (apiPrefixes.some(prefix => req.path.startsWith(prefix))) {
            return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

io.on('connection', (socket) => {
    console.log('Dashboard connected');
    socket.emit('status', connectionStatus);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend and Frontend listening at port ${PORT}`);
});
