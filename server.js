const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cors = require('cors');
const app = express();
const port = 3000;

// Middleware configuration
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
app.use('/WST-Website', express.static('WST-website'));
app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Database connection
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Luna11092018',
    database: 'wst_database'
});

db.connect(err => {
    if (err) {
        console.error('Could not connect to the database:', err);
        return;
    }
    console.log('Connected to the database');
});

// Serve default load.html page
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/load.html');
});

// User login route
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide both username and password' });
    }

    const query = 'SELECT * FROM belly WHERE username = ?';
    db.query(query, [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        if (results.length > 0) {
            const user = results[0];
            bcrypt.compare(password, user.password, (err, isMatch) => {
                if (err) return res.status(500).json({ success: false, message: 'Error comparing password' });

                if (isMatch) {
                    req.session.user = { userId: user.user_id, username: user.username };
                    res.json({ success: true, message: 'Login successful', redirectUrl: '/WST-Website/index.html' });
                } else {
                    res.status(401).json({ success: false, message: 'Invalid login credentials' });
                }
            });
        } else {
            res.status(401).json({ success: false, message: 'User not found' });
        }
    });
});

// Fetch logged-in user data
app.get('/get-user', (req, res) => {
    if (req.session.user) {
        res.status(200).json({ success: true, username: req.session.user.username, userId: req.session.user.userId });
    } else {
        res.status(401).json({ success: false, message: 'Not logged in' });
    }
});

// User registration route
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, message: 'Please provide both username and password' });
    }

    const checkQuery = 'SELECT * FROM belly WHERE username = ?';
    db.query(checkQuery, [username], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        if (results.length > 0) {
            return res.status(400).json({ success: false, message: 'Username already exists' });
        }

        bcrypt.hash(password, 10, (err, hashedPassword) => {
            if (err) return res.status(500).json({ success: false, message: 'Error hashing password' });

            const userId = Math.floor(100000 + Math.random() * 900000);
            const query = 'INSERT INTO belly (user_id, username, password) VALUES (?, ?, ?)';
            db.query(query, [userId, username, hashedPassword], (err) => {
                if (err) return res.status(500).json({ success: false, message: 'Database error' });

                res.json({ success: true, message: 'Registration successful', userId });
            });
        });
    });
});

// Admin login route
app.post('/admin/login', (req, res) => {
    const { admin_name, admin_password } = req.body;

    if (!admin_name || !admin_password) {
        return res.status(400).json({ success: false, message: 'Please provide both admin name and password' });
    }

    const query = 'SELECT * FROM admins WHERE admin_name = ?';
    db.query(query, [admin_name], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        if (results.length > 0 && admin_password === results[0].admin_password) {
            res.json({ success: true, redirectUrl: '/Admin Interface/admin.html' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid login credentials' });
        }
    });
});

// Create post
app.post('/create-post', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'You must be logged in to create a post' });
    }

    const { category, content } = req.body;
    const userId = req.session.user.userId;

    if (!category || !content) {
        return res.status(400).json({ success: false, message: 'Category and content are required' });
    }

    const query = 'INSERT INTO posts (user_id, category, content) VALUES (?, ?, ?)';
    db.query(query, [userId, category, content], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Database error' });

        res.json({ success: true, message: 'Post created successfully', postId: results.insertId });
    });
});

// Fetch posts for logged-in user
app.get('/get-posts', (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const userId = req.session.user.userId;
    const query = `
        SELECT p.user_id, p.content, p.created_at, p.category, b.username
        FROM posts p
        JOIN belly b ON p.user_id = b.user_id
        WHERE p.user_id = ?
        ORDER BY p.created_at DESC
    `;

    db.query(query, [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Error fetching posts' });

        const formattedPosts = results.map(post => ({
            ...post,
            created_at: new Date(post.created_at).toISOString()
        }));
        res.json({ success: true, posts: formattedPosts });
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
