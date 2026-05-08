const assert = require('assert');
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');

const app = express();

const users = [];

(async () => {
    const adminHash = await bcrypt.hash('admin123', 10);
    users.push({ username: 'admin', password: adminHash });
    console.log('admin user loaded');
    
    // Simulate login logic
    const req = { body: { username: 'admin', password: 'admin123' } };
    const res = {
        redirect: (url) => { console.log('Redirected to:', url); },
        send: (msg) => { console.log('Sent:', msg.substring(0, 50)); },
        status: (code) => ({ send: (msg) => console.log('Error:', code, msg) })
    };
    
    // Login handler logic extracted
    const { username, password } = req.body;
    try {
        const user = users.find(u => u.username === username);
        if (user) {
            const match = await bcrypt.compare(password, user.password);
            if (match) return res.redirect('/dashboard');
        }
        res.send('Authentication Error');
    } catch (err) {
        res.status(500).send('Internal Error');
    }
})();
