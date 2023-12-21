const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('db.sqlite3')


db.serialize(() => {
    db.run(`
    CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        photo TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    `)
    db.run(`
    CREATE TABLE chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        photo TEXT,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    );
    `)
    db.run(`
    CREATE TABLE chatmembers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    `)
    db.run(`
    CREATE TABLE messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        chat_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        text TEXT NOT NULL,
        media_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (chat_id) REFERENCES chats (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
    );
    `)


    // const stmt = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)");
    // stmt.run(1, 'Alex', '123@gmail.com', '123', 14);
    // stmt.run(2, 'Al5ex', '223@gmail.com', '123', 24);
    // stmt.run(3, 'Al3ex', '2243@gmail.com', '123', 15);
    // stmt.run(4, 'Ale4x', '2233@gmail.com', '123', 17);
    // stmt.run(5, 'Al2ex', '2232@gmail.com', '123', 22);
    // stmt.finalize();

    // db.each("SELECT * FROM users", (err,row) => {
    //     console.log(row)
    // })
})

db.close();