const express = require('express');
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const { PrismaClient } = require('@prisma/client');
const flash = require('connect-flash');
const path = require('path');
const crypto = require('crypto');
const WebSocket = require('ws');


const prisma = new PrismaClient();
const app = express();
const wss = new WebSocket.Server({ port: 8080 });

// Middleware

app.use(session({
    secret: crypto.randomBytes(64).toString('hex'),
    resave: false,
    saveUninitialized: false,
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

app.use(flash()); // Add this line to use flash messages

app.use((req, res, next) => {
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.error = req.flash('error');
    next();
});

// Passport Local Strategy for username/password authentication
passport.use(new LocalStrategy({
    usernameField: 'username',
    passwordField: 'password'
}, async (username, password, done) => {
    try {
        // Ensure `username` is a unique field in your Prisma schema
        const user = await prisma.users.findUnique({
            where: { username },
        });

        if (!user) {
            return done(null, false, { message: 'Incorrect username or password.' });
        }

        if (password != user.password) {
            return done(null, false, { message: 'Incorrect username or password.' });
        }

        return done(null, user);
    } catch (error) {
        return done(error);
    }
}));

// Serialize and Deserialize user for session management
passport.serializeUser((user, done) => {
    done(null, user.id); // Ensure UserId is correct and exists
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
    if (req.isAuthenticated()) {
        return next();
    }
    res.redirect('/login');
}

// Routes
app.get('/', isAuthenticated, (req, res) => {
    res.sendFile(path.join(__dirname, '/public/index.html'));
});

app.post('/api/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            return res.status(500).json({ success: false, message: err.message });
        }
        if (!user) {
            return res.status(401).json({ success: false, message: info.message });
        }
        req.logIn(user, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            return res.json({ success: true });
        });
    })(req, res, next);
});

wss.on('connection', (ws, request) => {
    console.log('Client connected');
    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        console.log(data)
        if (data.type == "sell_soul") {
            console.log(data.user + " soul selled for " + data.message + " $");
            userId = await prisma.users.findUnique({
                where: {
                    username: data.user
                },
                select: {
                    id: true
                }
            });
            balance = await prisma.cuenta.update({
                where: {
                    user_id: userId.id
                },
                data: {
                    amount: {
                        increment: parseInt(data.message)
                    }
                },
                select: {
                    amount: true
                }
            });
            sendMessage(ws,"update_balance",balance.amount);
        }
    });
});

async function getUserBalance(user) {
    userId = await prisma.users.findUnique({
        where: {
            username: user
        },
        select: {
            id: true
        }
    });
    balance = await prisma.cuenta.findUnique({
        where: {
            user_id: userId.id
        },
        select: {
            amount: true
        }
    });
    return balance;
}

function sendMessage(ws,type,content) {
    // Create a message object
    const message = {
        type: type,
        message: content,
    };

    // Send the message as a JSON string
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        console.log(message)
    } else {
        console.error('WebSocket is not open. Unable to send message.');
    }
}

app.use(express.static('public'))

const PORT = process.env.PORT || 3010;
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

app.on('upgrade', (request, socket, head) => {
    // Use the session parser to process the session data from the request
    sessionParser(request, {}, () => {
        // Check if the request has a valid session with an authenticated user
        if (request.session.passport && request.session.passport.user) {
            // If authenticated, handle the WebSocket upgrade request
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            // If not authenticated, close the connection
            socket.destroy();
        }
    });
});

