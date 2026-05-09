CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50),
    price DECIMAL(10,2)
);

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_name VARCHAR(100),
    item_name TEXT,
    price DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'Aberto',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


INSERT INTO
    items (name, category, price)
VALUES 
    ('Arroz Branco', 'Base', 12.50),
    ('Feijão Preto', 'Grão', 10.00),
    ('Frango Grelhado', 'Proteína', 18.90),
    ('Salada Mista', 'Vegetal', 15.00);

INSERT INTO
    orders (customer_name, item_name, price, status)
VALUES
    ('João Silva', 'Arroz Branco', 12.50, 'Aberto'),
    ('Maria Oliveira', 'Frango Grelhado', 18.90, 'Aberto'),
    ('Carlos Santos', 'Feijão Preto', 10.00, 'Aberto'),
    ('Ana Costa', 'Salada Mista', 15.00, 'Aberto');