const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');

const app = express();

/*
// ==========================================
// CÓDIGO DO BANCO DE DADOS MYSQL (COMENTADO)
// ==========================================
const mysql = require('mysql2/promise');

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || 'password',
    database: process.env.DB_NAME || 'marmitadb'
};

let pool;

async function connectWithRetry() {
    console.log('🔍 [INFRA] Tentando conectar ao MySQL...');
    for (let i = 1; i <= 10; i++) {
        try {
            pool = mysql.createPool(dbConfig);
            await pool.query('SELECT 1');
            console.log('✅ [DATABASE] Conectado ao MySQL com sucesso!');
            
            const [adminRows] = await pool.query('SELECT * FROM users WHERE username = "admin"');
            if (adminRows.length === 0) {
                const adminHash = await bcrypt.hash('admin123', 10);
                await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', ['admin', adminHash]);
                console.log('✅ [DATABASE] Usuário admin inserido com hash.');
            }
            return;
        } catch (err) {
            console.log(`⚠️ [DATABASE] Tentativa ${i}/10 falhou. Aguardando...`);
            await new Promise(res => setTimeout(res, 3000));
        }
    }
    process.exit(1);
}

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
            const match = await bcrypt.compare(password, user.password);
            if (match) return res.redirect('/dashboard');
        }
        res.send('<h1>Login Inválido</h1><a href="/">Voltar</a>');
    } catch (err) {
        res.status(500).send("Erro no banco.");
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        const hash = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
        res.json({ success: true, message: 'Conta criada com sucesso!' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erro ao cadastrar.' });
    }
});

app.post('/add-item', async (req, res) => {
    const { name, category } = req.body;
    try {
        await pool.query('INSERT INTO items (name, category) VALUES (?, ?)', [name, category]);
        res.redirect('/dashboard');
    } catch (err) {
        res.status(500).send("Erro ao adicionar");
    }
});

app.get('/dashboard', async (req, res) => {
    const [items] = await pool.query('SELECT * FROM items');
    const [orders] = await pool.query('SELECT * FROM orders');
    res.render('dashboard', { items, orders });
});

connectWithRetry().then(() => {
    app.listen(3000, () => console.log('🚀 BYTEBISTRÔ PRO ONLINE NA PORTA 3000'));
});
// ==========================================
*/


// ==========================================
// CÓDIGO ATUAL: VALIDAÇÃO EM MEMÓRIA (CÓDIGO)
// ==========================================
const users = [];
const items = [
    { name: 'Arroz Branco', category: 'Base' },
    { name: 'Feijão Preto', category: 'Grão' }
];
const orders = [];

// Cria o usuário admin padrão
(async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    users.push({ username: 'admin', password: adminHash });
    console.log('✅ [IN-MEMORY DB] Usuário admin carregado (Login: admin / Senha: admin123).');
})();

app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.get('/', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = users.find(u => u.username === username);
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) return res.redirect('/dashboard');
        }
        res.send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Erro de Autenticação</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">Usuário ou senha inválidos.</p>
                <a href="/" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Tentar Novamente</a>
            </body>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Erro Interno</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">Ocorreu um erro ao processar seu login.</p>
                <a href="/" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Voltar</a>
            </body>
        `);
    }
});

app.get('/register', (req, res) => res.render('register'));

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (users.find(u => u.username === username)) {
            return res.status(400).json({ success: false, message: 'Usuário já existe!' });
        }
        const hash = await bcrypt.hash(password, 10);
        users.push({ username, password: hash });
        res.json({ success: true, message: 'Conta criada com sucesso! Você já pode fazer login.' });
    } catch (err) {
        console.error("Erro interno no cadastro:", err);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar: Erro interno.' });
    }
});

app.post('/add-item', (req, res) => {
    const { name, category } = req.body;
    if (!name) {
        return res.status(400).send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Dados Inválidos</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">O nome do ingrediente é obrigatório.</p>
                <a href="/dashboard" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Voltar pro Dashboard</a>
            </body>
        `);
    }
    items.push({ name, category });
    res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
    res.render('dashboard', { items, orders });
});

app.listen(3000, () => {
    console.log('🚀 BYTEBISTRÔ PRO ONLINE NA PORTA 3000 (MODO IN-MEMORY)');
});
