const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

const app = express();

// Segurança: Ocultar o fingerprint do Express (Sonar Hotspot)
app.disable('x-powered-by');

// Middlewares
app.get('/bg-login.jpg', (req, res) => res.sendFile(path.join(__dirname, 'foto_restaurante.png')));
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Configuração do Banco de Dados
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER || 'user',
    password: process.env.DB_PASS || '', // Removido hardcoded password p/ SonarQube
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
            
            await pool.query(`
                CREATE TABLE IF NOT EXISTS transactions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    type VARCHAR(10) NOT NULL,
                    description VARCHAR(255) NOT NULL,
                    amount DECIMAL(10,2) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            
            const [adminRows] = await pool.query('SELECT * FROM users WHERE username = ?', ['admin']);
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

// Rotas
app.get('/', (req, res) => res.render('login'));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (rows.length > 0) {
            const user = rows[0];
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
        console.error("Erro no login:", err);
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
        const [existing] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Usuário já existe!' });
        }
        const hash = await bcrypt.hash(password, 10);
        await pool.query('INSERT INTO users (username, password) VALUES (?, ?)', [username, hash]);
        res.json({ success: true, message: 'Conta criada com sucesso! Você já pode fazer login.' });
    } catch (err) {
        console.error("Erro interno no cadastro:", err);
        res.status(500).json({ success: false, message: 'Erro ao cadastrar: Erro interno.' });
    }
});

app.post('/add-item', async (req, res) => {
    const { name, category, price } = req.body;
    
    if (!name || name.trim() === '') {
        return res.status(400).send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Dados Inválidos</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">O nome da marmita/ingrediente não pode estar vazio.</p>
                <a href="/dashboard" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Voltar pro Dashboard</a>
            </body>
        `);
    }

    const priceNum = parseFloat(price);
    if (isNaN(priceNum) || priceNum <= 0) {
        return res.status(400).send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Dados Inválidos</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">O preço deve ser um número positivo.</p>
                <a href="/dashboard" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Voltar pro Dashboard</a>
            </body>
        `);
    }

    try {
        await pool.query('INSERT INTO items (name, category, price) VALUES (?, ?, ?)', [name, category, priceNum]);
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Erro ao adicionar:", err);
        res.status(500).send("Erro ao adicionar ingrediente.");
    }
});

app.post('/orders', async (req, res) => {
    const { customer_name } = req.body;
    let item_names = req.body.item_name;
    
    if (!customer_name || customer_name.trim() === '' || !item_names) {
        return res.status(400).send(`
            <body style="background:#0f1115;color:#ffffff;font-family:'Inter', sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;flex-direction:column;margin:0;">
                <h1 style="color:#ff6b6b;margin-bottom:8px;">Dados Inválidos</h1>
                <p style="color:#8b92a5;margin-bottom:24px;">Nome do cliente e seleção da marmita são obrigatórios.</p>
                <a href="/dashboard" style="color:#fca311;text-decoration:none;font-weight:500;">&laquo; Voltar pro Dashboard</a>
            </body>
        `);
    }

    if (!Array.isArray(item_names)) {
        item_names = [item_names];
    }

    try {
        const placeholders = item_names.map(() => '?').join(',');
        const [items] = await pool.query(`SELECT price FROM items WHERE name IN (${placeholders})`, item_names);
        
        let totalPrice = 0;
        items.forEach(i => totalPrice += parseFloat(i.price || 0));
        
        const itemsJoined = item_names.join(' + ');
        
        await pool.query('INSERT INTO orders (customer_name, item_name, price, status) VALUES (?, ?, ?, ?)', [customer_name, itemsJoined, totalPrice, 'Aberto']);
        
        // Registrar transação financeira de entrada automaticamente
        const desc = `Venda: ${customer_name} (${itemsJoined})`;
        await pool.query('INSERT INTO transactions (type, description, amount) VALUES (?, ?, ?)', ['entrada', desc.substring(0, 255), totalPrice]);
        
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Erro ao registrar pedido:", err);
        res.status(500).send("Erro ao registrar pedido.");
    }
});

app.post('/orders/advance/:id', async (req, res) => {
    const orderId = req.params.id;
    try {
        const [rows] = await pool.query('SELECT status FROM orders WHERE id = ?', [orderId]);
        if (rows.length === 0) return res.status(404).send("Pedido não encontrado.");
        
        let currentStatus = rows[0].status;
        let nextStatus = currentStatus;
        
        if (currentStatus === 'Aberto') nextStatus = 'Cozinha';
        else if (currentStatus === 'Cozinha') nextStatus = 'Entrega';
        else if (currentStatus === 'Entrega') nextStatus = 'Entregue';
        
        if (nextStatus !== currentStatus) {
            await pool.query('UPDATE orders SET status = ? WHERE id = ?', [nextStatus, orderId]);
        }
        res.redirect('/kanban');
    } catch (err) {
        console.error("Erro ao atualizar status:", err);
        res.status(500).send("Erro ao atualizar status.");
    }
});

app.get('/admin/export', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
        
        let csvContent = 'ID;Cliente;Marmita;Status;Valor;Data\n';
        orders.forEach(order => {
            const dateStr = order.created_at ? order.created_at.toLocaleString('pt-BR') : '';
            const priceStr = order.price ? parseFloat(order.price).toFixed(2).replace('.', ',') : '0,00';
            csvContent += `${order.id};${order.customer_name};${order.item_name};${order.status};R$ ${priceStr};${dateStr}\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="relatorio_vendas.csv"');
        res.send(Buffer.from('\uFEFF' + csvContent, 'utf-8')); // \uFEFF = BOM para o Excel ler acentos
    } catch (err) {
        console.error("Erro na exportação CSV:", err);
        res.status(500).send("Erro ao gerar relatório.");
    }
});

app.get('/dashboard', async (req, res) => {
    try {
        const [items] = await pool.query('SELECT * FROM items');
        const [orders] = await pool.query('SELECT * FROM orders');
        
        const [transactions] = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
        let totalEntradas = 0;
        let totalSaidas = 0;
        transactions.forEach(t => {
            const val = parseFloat(t.amount);
            if (t.type === 'entrada') totalEntradas += val;
            else if (t.type === 'saida') totalSaidas += val;
        });
        const saldo = totalEntradas - totalSaidas;
        
        res.render('dashboard', { items, orders, transactions, totalEntradas, totalSaidas, saldo });
    } catch (err) {
        console.error("Erro ao carregar dashboard:", err);
        res.status(500).send("Erro ao carregar dashboard.");
    }
});

app.get('/kanban', async (req, res) => {
    try {
        const [orders] = await pool.query('SELECT * FROM orders');
        res.render('kanban', { orders });
    } catch (err) {
        console.error("Erro ao carregar kanban:", err);
        res.status(500).send("Erro ao carregar kanban.");
    }
});

app.post('/financeiro/add', async (req, res) => {
    const { type, description, amount } = req.body;
    
    if (!description || !amount || (type !== 'entrada' && type !== 'saida')) {
        return res.status(400).send("Dados inválidos para transação.");
    }
    
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
        return res.status(400).send("O valor deve ser positivo.");
    }
    
    try {
        await pool.query('INSERT INTO transactions (type, description, amount) VALUES (?, ?, ?)', [type, description, numAmount]);
        res.redirect('/dashboard');
    } catch (err) {
        console.error("Erro ao adicionar transação:", err);
        res.status(500).send("Erro ao adicionar transação.");
    }
});

connectWithRetry().then(() => {
    app.listen(3000, () => {
        console.log('🚀 BYTEBISTRÔ PRO ONLINE NA PORTA 3000 (MODO BANCO DE DADOS)');
    });
});
