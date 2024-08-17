const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const passport = require('passport');

const prisma = new PrismaClient();

async function singUp(req, res) {
    try {
        const { username, password } = req.body;

        const existingUser = await prisma.users.findUnique({ where: { username } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Username is already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await prisma.users.create({
            data: {
                username: username,
                password: hashedPassword,
                cuentas: {  // Create the associated account
                    create: {
                        amount: 0, // Initial account balance
                    }
                }
            },
        });



        req.logIn(newUser, (err) => {
            if (err) {
                return res.status(500).json({ success: false, message: err.message });
            }
            return res.json({ success: true, message: 'Account created and user logged in.' });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
}

async function logIn(req, res, next) {
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
}

module.exports = {
    singUp,
    logIn
};