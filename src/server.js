const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { PrismaClient } = require('@prisma/client');
const flash = require('connect-flash');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');

const prisma = new PrismaClient();
const app = express();
const wss = new WebSocket.Server({ port: 8080 });

const api = require("./api.js");
const wsManager = require("./wsManager.js");

// Middleware
app.use(session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(flash());

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Passport Local Strategy
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        const user = await prisma.users.findUnique({ where: { username } });

        if (!user) {
            return done(null, false, { message: 'Incorrect username or password.' });
        }

        const match = await bcrypt.compare(password, user.password);
        if (match) {
            return done(null, user);
        } else {
            return done(null, false, { message: 'Incorrect username or password.' });
        }
    } catch (error) {
        return done(error);
    }
}));

// Serialize and Deserialize user for session management
passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await prisma.users.findUnique({ where: { id } });
        done(null, user);
    } catch (error) {
        done(error);
    }
});

function isAuthenticated(req, res, next) {
    if (req.isAuthenticated()) return next();
    res.redirect('/login');
}

// Routes
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.post('/api/login', [
    body('username').trim().isLength({ min: 1 }).escape().withMessage('Username is required'),
    body('password').trim().isLength({ min: 6 }).escape().withMessage('Password must be at least 6 characters long')
], (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    api.logIn(req, res, next);
});

app.post('/api/sign-up', [
    body('username').trim().isLength({ min: 1 }).escape().withMessage('Username is required'),
    body('password').trim().isLength({ min: 6 }).escape().withMessage('Password must be at least 6 characters long'),
    body('email').isEmail().normalizeEmail().withMessage('Invalid email address')
], async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    api.singUp(req, res);
});

wss.on('connection', (ws, request) => {
    console.log('Client connected');
    ws.on('message', async (message) => {
        wsManager(ws, message);
    });
});

app.use(express.static('../public'));

// Centralized error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Something went wrong. Please try again later.'
    });
});

// Handle 404 errors
app.use((req, res, next) => {
    res.status(404).json({
        message: 'Not Found'
    });
});

const PORT = process.env.PORT || 3010;

// HTTP server (for development or when HTTPS is not needed)
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

/*
// HTTPS configuration (commented out)
const https = require('https');
const fs = require('fs');

const options = {
    key: fs.readFileSync('/path/to/your/privkey.pem'),
    cert: fs.readFileSync('/path/to/your/fullchain.pem')
};

// HTTPS server (uncomment this to enable HTTPS)
https.createServer(options, app).listen(PORT, () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
*/

app.on('upgrade', (request, socket, head) => {
    sessionParser(request, {}, () => {
        if (request.session.passport && request.session.passport.user) {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });
});
