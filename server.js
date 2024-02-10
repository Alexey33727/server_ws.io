const WebSocket = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const express = require('express')
const http = require('http')
const cors = require('cors');

const app = express()
app.use(cors({origin: "*"}))
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With");
    res.header("Access-Control-Allow-Headers", "Content-Type");
    res.header("Access-Control-Allow-Methods", "PUT, GET, POST, DELETE, OPTIONS");
    next();
});
const server = http.createServer(app)

const wss = new WebSocket.Server(server, {
    maxHttpBufferSize: 20000000 * 1024, // 20000MB
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const db = new sqlite3.Database('db.sqlite3');

const secretKey = "your-secret-key"


wss.on('connection', function connection(ws) {

    function generateAccessToken(user) {
        return jwt.sign({ username: user }, secretKey, { expiresIn: '1h' });
    }

    function authenticateToken(token) {
        try {
            jwt.verify(token, secretKey);
            return true;
        } catch (err) {
            return false;
        }
    }



    // Функция для поиска пользователя по email
    function findUserByEmail(email, callback) {
        db.get('SELECT * FROM users WHERE email = ?', email, function (err, row) {
            if (err) {
                console.error(err);
                callback(null);
            } else {
                callback(row);
            }
        });
    }


    // Функция для создания переписки
    function createChat(name, createdBy, users, photo) {
        db.run("INSERT INTO chats (name, created_by, photo) VALUES (?, ?, ?)", [name, createdBy, photo], function (err) {
            if (err) {
                console.error(err.message);
                ws.emit("message",JSON.stringify({ success: false, error: err.message }));
                return;
            }

            const chatId = this.lastID;

            // Вставка данных в таблицу "chatmembers"
            const stmt = db.prepare("INSERT INTO chatmembers (chat_id, user_id) VALUES (?, ?)");

            users.forEach((userId) => {
                stmt.run([chatId, userId], function (err) {
                    if (err) {
                        console.error(err.message);
                        ws.emit("message",JSON.stringify({ success: false, error: err.message }));
                        return;
                    }
                });
            });

            stmt.finalize((err) => {
                if (err) {
                    console.error(err.message);
                    ws.emit("message",JSON.stringify({ success: false, error: err.message }));
                    return;
                }

                ws.emit("message",JSON.stringify({ type: "createChat", success: true }));
            })
        })

    }

    // Функция для отправки сообщений
    function sendMessage(chatId, userId, text, mediaUrl, callback) {
        db.run('INSERT INTO messages (chat_id, user_id, text, media_url) VALUES (?, ?, ?, ?)', [chatId, userId, text, mediaUrl], function (err) {
            if (err) {
                console.error(err);
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    // Функция для регистрации
    function register(username, password, email, callback) {
        db.run('INSERT INTO users (username, password, email) VALUES (?, ?, ?)', [username, password, email], function (err) {
            if (err) {
                console.error(err);
                callback(false);
            } else {
                const accessToken = generateAccessToken(username);
                callback(true, accessToken);
            }
        });
    }

    // Функция для логина
    function login(email, password, callback) {
        db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], function (err, row) {
            if (err) {
                console.error(err);
                callback(null);
            } else {
                if (row) {
                    const accessToken = generateAccessToken(row.username);
                    callback(row, accessToken);
                }
                else {
                    console.error("err");
                    callback(null);
                }
            }
        });
    }

    // Функция для смены фото в таблице users
    function changePhoto(userId, photo, callback) {
        db.run('UPDATE users SET photo = ? WHERE id = ?', [photo, userId], function (err) {
            if (err) {
                console.error(err);
                callback(false);
            } else {
                callback(true);
            }
        });
    }

    // Функция для получения списка чатов определенного пользователя
    function getChatsByUser(userId, csl, callback) {
        db.all('SELECT c.id, c.name, c.created_at, c.photo FROM chats c JOIN chatmembers cm ON c.id = cm.chat_id WHERE cm.user_id = ?', userId, function (err, rows) {
            if (err) {
                console.error(err);
                callback([], csl);
            } else {
                callback(rows, csl);
            }
        });
    }

    // Функция для получения списка сообщений из определенного чата
    function getMessagesByChat(chatId, msl, callback) {
        db.all('SELECT m.id, m.text, m.media_url, m.created_at, u.username, u.email, m.user_id FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_id = ?', chatId, function (err, rows) {
            if (err) {
                console.error(err);
                callback([], msl);
            } else {
                callback(rows, msl);
            }
        });
    }

    // Функция для проверки на регистрацию
    function checkRegistration(email, callback) {
        db.get('SELECT * FROM users WHERE email = ?', email, function (err, row) {
            if (err) {
                console.error(err);
                callback(false);
            } else {
                callback(row !== undefined);
            }
        });
    }

    ws.on('message', function incoming(data) {
        console.log('fvb');
        const request = JSON.parse(data);
        console.log(request);

        switch (request.type) {
            case 'findUserByEmail':
                authenticateToken(request.acsess)
                    ? findUserByEmail(request.email, function (user) {
                        const response = {
                            type: 'user',
                            user: user
                        };
                        ws.emit("message",JSON.stringify(response));
                    })
                    : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'createChat':
                authenticateToken(request.acsess)
                    ? createChat(request.name, request.createdBy, request.users, request.photo)
                    : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'sendMessage':
                authenticateToken(request.acsess)
                    ? sendMessage(request.chatId, request.userId, request.text, request.mediaUrl, function (success) {
                        const response = {
                            type: 'success',
                            success: success
                        };
                        ws.emit("message",JSON.stringify(response));
                        // updMessagesByChat(request.chatId)
                    }) : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'register':
                register(request.username, request.password, request.email, function (success, acsess) {
                    if (success) {
                        const response = {
                            type: 'success',
                            success: success,
                            acsessToken: acsess,
                        };
                        ws.emit("message",JSON.stringify(response));
                    } else {
                        const response = {
                            type: 'error',
                            message: 'Registration failed'
                        };
                        ws.emit("message",JSON.stringify(response));
                    }
                });
                break;
            case 'login':
                login(request.email, request.password, function (user, acsess) {
                    if (user) {
                        const response = {
                            type: 'user',
                            user: user,
                            acsessToken: acsess,
                        };
                        ws.emit("message",JSON.stringify(response));
                    } else {
                        const response = {
                            type: 'error',
                            message: 'Incorrect email or password'
                        };
                        ws.emit("message",JSON.stringify(response));
                    }
                });
                break;
            case 'changePhoto':
                authenticateToken(request.acsess)
                    ? changePhoto(request.userId, request.photo, function (success) {
                        const response = {
                            type: 'success',
                            success: success
                        };
                        ws.emit("message",JSON.stringify(response));
                    })
                    : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'getChatsByUser':
                let csl = { a: undefined }
                authenticateToken(request.acsess)
                    ? setInterval(() => {
                        getChatsByUser(request.userId, csl, function (chats, csl) {
                            if (chats.length !== csl.a) {
                                csl.a = chats.length
                                const response = {
                                    type: 'chats',
                                    chats: chats
                                };
                                ws.emit("message",JSON.stringify(response));
                            }
                        });
                    }, 1000)
                    : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'getMessagesByChat':
                let msl = { a: undefined }
                authenticateToken(request.acsess)
                    ? setInterval(() => {
                        getMessagesByChat(request.chatId, msl, function (messages, msl) {
                            if (messages.length !== msl.a) {
                                msl.a = messages.length
                                const response = {
                                    type: 'messages',
                                    messages: messages
                                };
                                ws.emit("message",JSON.stringify(response));
                            }
                        });
                    }, 1000)
                    : ws.emit("message",JSON.stringify({
                        type: 'error',
                        message: "Wrong token or you don't have token "
                    }))
                break;
            case 'checkRegistration':
                checkRegistration(request.email, function (isRegistered) {
                    const response = {
                        type: 'isRegistered',
                        isRegistered: isRegistered
                    };
                    ws.emit("message",JSON.stringify(response));
                });
                break;
            default:
                break;
        }
    });
});


server.listen(5000, () => {
    console.log("server started on 5000 port");
})
