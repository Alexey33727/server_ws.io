const WebSocket = require('ws');
const sqlite3 = require('sqlite3').verbose();

const wss = new WebSocket.Server({ port: 8080 });

const db = new sqlite3.Database('db.sqlite3');

wss.on('connection', function connection(ws) {
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

    // Функция для создания группы
    function createGroup(name, createdBy, callback) {
        db.run('INSERT INTO chats (name, created_by) VALUES (?, ?)', [name, createdBy], function (err) {
            if (err) {
                console.error(err);
                callback(null);
            } else {
                callback(this.lastID);
            }
        });
    }

    // Функция для создания переписки
    function createChat(name, createdBy, callback) {
        db.run('INSERT INTO chats (name, created_by) VALUES (?, ?)', [name, createdBy], function (err) {
            if (err) {
                console.error(err);
                callback(null);
            } else {
                const chatId = this.lastID;
                db.run('INSERT INTO chatmembers (chat_id, user_id) VALUES (?, ?)', [chatId, createdBy], function (err) {
                    if (err) {
                        console.error(err);
                        callback(null);
                    } else {
                        callback(chatId);
                    }
                });
            }
        });
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
                callback(true);
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
                callback(row);
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
        db.all('SELECT c.id, c.name, c.created_at FROM chats c JOIN chatmembers cm ON c.id = cm.chat_id WHERE cm.user_id = ?', userId, function (err, rows) {
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
        db.all('SELECT m.id, m.text, m.media_url, m.created_at, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_id = ?', chatId, function (err, rows) {
            if (err) {
                console.error(err);
                callback([], msl);
            } else {
                callback(rows, msl);
            }
        });
    }
    // function updMessagesByChat(chatId) {
    //     db.all('SELECT m.id, m.text, m.media_url, m.created_at, u.username FROM messages m JOIN users u ON m.user_id = u.id WHERE m.chat_id = ?', chatId, function (err, rows) {
    //         if (err) {
    //             console.error(err);
    //         }
    //     });

    // }

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
        const request = JSON.parse(data);

        switch (request.type) {
            case 'findUserByEmail':
                findUserByEmail(request.email, function (user) {
                    const response = {
                        type: 'user',
                        user: user
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'createGroup':
                createGroup(request.name, request.createdBy, function (chatId) {
                    const response = {
                        type: 'chatId',
                        chatId: chatId
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'createChat':
                createChat(request.name, request.createdBy, function (chatId) {
                    const response = {
                        type: 'chatId',
                        chatId: chatId
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'sendMessage':
                sendMessage(request.chatId, request.userId, request.text, request.mediaUrl, function (success) {
                    const response = {
                        type: 'success',
                        success: success
                    };
                    ws.send(JSON.stringify(response));
                    // updMessagesByChat(request.chatId)
                });
                break;
            case 'register':
                register(request.username, request.password, request.email, function (success) {
                    const response = {
                        type: 'success',
                        success: success
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'login':
                login(request.email, request.password, function (user) {
                    const response = {
                        type: 'user',
                        user: user
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'changePhoto':
                changePhoto(request.userId, request.photo, function (success) {
                    const response = {
                        type: 'success',
                        success: success
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            case 'getChatsByUser':
                let csl = { a: undefined }
                setInterval(() => {
                    getChatsByUser(request.userId, csl, function (chats, csl) {
                        if (chats.length !== csl.a) {
                            csl.a = chats.length
                            const response = {
                                type: 'chats',
                                chats: chats
                            };
                            ws.send(JSON.stringify(response));
                        }
                    });
                }, 1000);
                break;
            case 'getMessagesByChat':
                let msl = { a: undefined }
                setInterval(() => {

                    getMessagesByChat(request.chatId, msl, function (messages, msl) {
                        if (messages.length !== msl.a) {
                            msl.a = messages.length
                            const response = {
                                type: 'messages',
                                messages: messages
                            };
                            ws.send(JSON.stringify(response));
                        }
                    });
                }, 1000);

                break;
            case 'checkRegistration':
                checkRegistration(request.email, function (isRegistered) {
                    const response = {
                        type: 'isRegistered',
                        isRegistered: isRegistered
                    };
                    ws.send(JSON.stringify(response));
                });
                break;
            default:
                break;
        }
    });
});
