const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function wsManager(ws, message) {
    const data = JSON.parse(message);
    console.log(data)
    if (data.type == "sell_soul") {
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
        sendMessage(ws, "update_balance", balance.amount);
    }
    if (data.type == "balance_check") {
        sendMessage(ws, "update_balance", await getUserBalance(data.user))
    }
    if (data.type == "transfer") {
        if (await getUserBalance(data.user) >= data.message.amount) {
            destinary = await prisma.users.findUnique({
                where: {
                    username: data.message.destinary
                },
                select: {
                    id: true
                }
            });
            if (!destinary) {
                sendMessage(ws, "invalid_transaction", "");
                return;
            }
            userId = await prisma.users.findUnique({
                where: {
                    username: data.user
                },
                select: {
                    id: true
                }
            });
            await prisma.cuenta.update({
                where: {
                    user_id: userId.id
                },
                data: {
                    amount: {
                        decrement: parseInt(data.message.amount)
                    }
                },
                select: {
                    amount: true
                }
            });
            await prisma.cuenta.update({
                where: {
                    user_id: destinary.id
                },
                data: {
                    amount: {
                        increment: parseInt(data.message.amount)
                    }
                },
                select: {
                    amount: true
                }
            });
            sendMessage(ws, "update_balance", await getUserBalance(data.user))
        } else {
            sendMessage(ws, "invalid_transaction", "");
            return;
        }
    }
    if (data.type == "change_username") {
        await prisma.users.update({
            where: { username: data.user },
            data: { username: data.message },
        });
        sendMessage(ws, "succesful_change_username", "")
    }
    if (data.type == "change_password") {
        await prisma.users.update({
            where: { username: data.user },
            data: { password: await bcrypt.hash(data.message, 10) },
        });
    }
}

function sendMessage(ws, type, content) {
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
    return balance.amount;
}

module.exports = wsManager;