const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Static Serving (Priority)
app.use(express.static(path.join(__dirname, '..')));

// Initialize Local Database File
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        admin: {
            username: 'admin',
            password: '1234'
        },
        posts: [
            {
                id: Date.now().toString(),
                title: '🚀 Scaling Neural Infrastructure',
                category: 'AI & Data',
                excerpt: 'Exploring the deployment of industrial-grade neural networks across distributed corporate networks.',
                content: 'Full strategic content for neural networks...',
                created_at: new Date().toISOString(),
                image_url: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800'
            }
        ],
        services: [],
        metrics: [],
        process: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// Helper: Read DB
const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
// Helper: Write DB
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// --- API ENDPOINTS ---

// Special Endpoint for Hero (Single Object)
app.get('/api/hero', (req, res) => {
    try {
        const db = readDB();
        res.json(db.hero || {});
    } catch (err) {
        res.status(500).json({ error: 'Failed to read hero data' });
    }
});

app.put('/api/hero', (req, res) => {
    try {
        const db = readDB();
        db.hero = req.body;
        writeDB(db);
        res.json(db.hero);
    } catch (err) {
        res.status(400).json({ error: 'Failed to update hero data' });
    }
});

// 1. Auth Endpoint (Database-backed)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    try {
        const db = readDB();
        const admin = db.admin || { username: 'admin', password: '1234' }; // Fallback

        if (username === admin.username && password === admin.password) {
            res.json({ success: true, message: 'Authentication Successful' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Credentials' });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server Authentication Error' });
    }
});

// 2. Contact Form Endpoint (Email via Gmail SMTP)
app.post('/api/contact', async (req, res) => {
    const { name, email, company, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'Name, email, and message are required.' });
    }

    // Check if email credentials are configured
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.error('❌ Email credentials not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD env vars.');
        return res.status(500).json({ success: false, message: 'Email service not configured.' });
    }

    try {
        // Create Nodemailer transporter with Gmail
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });

        // Email content
        const mailOptions = {
            from: `"Creashift Contact Form" <${process.env.GMAIL_USER}>`,
            to: process.env.GMAIL_USER, // Send to yourself
            replyTo: email,
            subject: `🚀 New Contact from ${name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: #fff; border-radius: 12px;">
                    <h1 style="color: #a855f7; margin-bottom: 20px;">New Contact Form Submission</h1>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                        <p><strong style="color: #a855f7;">Name:</strong> ${name}</p>
                        <p><strong style="color: #a855f7;">Email:</strong> <a href="mailto:${email}" style="color: #60a5fa;">${email}</a></p>
                        <p><strong style="color: #a855f7;">Company:</strong> ${company || 'Not provided'}</p>
                    </div>
                    <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px;">
                        <p><strong style="color: #a855f7;">Message:</strong></p>
                        <p style="white-space: pre-wrap;">${message}</p>
                    </div>
                    <p style="margin-top: 20px; font-size: 12px; color: #888;">Sent via Creashift Contact Form</p>
                </div>
            `
        };

        await transporter.sendMail(mailOptions);
        console.log(`✅ Contact email sent from ${name} (${email})`);
        res.json({ success: true, message: 'Message sent successfully!' });
    } catch (err) {
        console.error('❌ Email send error:', err);
        res.status(500).json({ success: false, message: 'Failed to send message. Please try again later.' });
    }
});

// --- Generic CRUD Factory ---
const setupCRUD = (resourceName) => {
    // GET all
    app.get(`/api/${resourceName}`, (req, res) => {
        try {
            const db = readDB();
            res.json(db[resourceName] || []);
        } catch (err) {
            res.status(500).json({ error: `Failed to read ${resourceName}` });
        }
    });

    // POST new
    app.post(`/api/${resourceName}`, (req, res) => {
        try {
            const db = readDB();
            const newItem = {
                id: Date.now().toString(),
                ...req.body,
                created_at: new Date().toISOString()
            };
            if (!db[resourceName]) db[resourceName] = [];
            db[resourceName].unshift(newItem);
            writeDB(db);
            res.status(201).json(newItem);
        } catch (err) {
            res.status(400).json({ error: `Failed to save ${resourceName}` });
        }
    });

    // PUT (UPDATE) by ID
    app.put(`/api/${resourceName}/:id`, (req, res) => {
        try {
            const db = readDB();
            if (db[resourceName]) {
                const index = db[resourceName].findIndex(item => item.id === req.params.id);
                if (index !== -1) {
                    // Keep the original id and created_at
                    const originalItem = db[resourceName][index];
                    db[resourceName][index] = {
                        ...req.body,
                        id: originalItem.id,
                        created_at: originalItem.created_at,
                        updated_at: new Date().toISOString()
                    };
                    writeDB(db);
                    res.json(db[resourceName][index]);
                } else {
                    res.status(404).json({ error: `${resourceName} item not found` });
                }
            } else {
                res.status(404).json({ error: `${resourceName} collection not found` });
            }
        } catch (err) {
            res.status(400).json({ error: `Failed to update ${resourceName}` });
        }
    });

    // DELETE by ID
    app.delete(`/api/${resourceName}/:id`, (req, res) => {
        try {
            const db = readDB();
            if (db[resourceName]) {
                db[resourceName] = db[resourceName].filter(item => item.id !== req.params.id);
                writeDB(db);
                res.json({ message: `${resourceName} deleted successfully` });
            } else {
                res.status(404).json({ error: `${resourceName} not found` });
            }
        } catch (err) {
            res.status(400).json({ error: `Failed to delete ${resourceName}` });
        }
    });
};

// Initialize Endpoints
['posts', 'services', 'metrics', 'process'].forEach(setupCRUD);

// --- FRONT-END ROUTING ---
// 1. Priority Static Serving (Handles all HTML, JS, CSS files)
app.use(express.static(path.join(__dirname, '..')));

// 2. 404 Fallback for API calls
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// 3. Fallback for unrecognized page paths (Optional: could serve index.html if needed)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
    console.log('\n=============================================');
    console.log('🚀 CREASHIFT LOCAL REVOLUTION STARTING...');
    console.log(`📡 Mainframe: http://localhost:${PORT}`);
    console.log('🔐 Auth: admin / 1234');
    console.log('📦 Database: Local JSON (No Supabase required)');
    console.log('=============================================\n');
});
