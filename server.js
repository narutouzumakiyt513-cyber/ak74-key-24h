const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static(__dirname));

const sessions = {}; 
const whitelist = {}; // Banco de dados da Whitelist (Imune graças ao UptimeRobot)

const KEY_DURATION_24H = 24 * 60 * 60 * 1000; 

// Rota para o UptimeRobot manter o Render online 24/7
app.get('/ping', (req, res) => res.send('Render Online 24/7'));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.get('/api/status', (req, res) => {
    const { id } = req.query;
    if (!sessions[id]) sessions[id] = { step: 0, ytClickTime: 0, linkClickTime: 0 };
    res.json(sessions[id]);
});

// --- MISSÃO 1: YOUTUBE ---
app.get('/api/click_yt', (req, res) => {
    const { id } = req.query;
    if (sessions[id]) sessions[id].ytClickTime = Date.now();
    res.json({ success: true });
});

app.get('/api/verify_yt', (req, res) => {
    const { id } = req.query;
    const session = sessions[id];
    if (!session || session.ytClickTime === 0) return res.json({ error: "Clique no botão primeiro!" });

    if (Date.now() - session.ytClickTime < 10000) return res.json({ error: "too_fast" });
    
    session.step = 1;
    res.json({ success: true, step: 1 });
});

// --- MISSÃO 2: LINKVERTISE ---
app.get('/api/start_linkvertise', (req, res) => {
    const { id } = req.query;
    if (sessions[id]) sessions[id].linkClickTime = Date.now();
    res.json({ success: true });
});

app.get('/api/verify_linkvertise', (req, res) => {
    const { id } = req.query;
    const session = sessions[id];
    if (!session || session.step < 1) return res.json({ error: "Complete a missão do YouTube!" });

    if (Date.now() - session.linkClickTime < 15000) return res.json({ error: "bypass_detected" });

    session.step = 2; 
    res.json({ success: true });
});

// --- BUSCA AVATAR ROBLOX ---
app.get('/api/roblox_info', async (req, res) => {
    const { query, type } = req.query; 
    try {
        let userId = query;
        let username = query;

        if (type === 'username') {
            const idRes = await fetch('https://users.roblox.com/v1/usernames/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ usernames: [query], excludeBannedUsers: false })
            });
            const idData = await idRes.json();
            if (!idData.data || idData.data.length === 0) return res.json({ error: "Usuário não encontrado!" });
            userId = idData.data[0].id;
            username = idData.data[0].name;
        } else {
            const nameRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
            if (!nameRes.ok) return res.json({ error: "ID inválido!" });
            const nameData = await nameRes.json();
            username = nameData.name;
        }

        const avatarRes = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`);
        const avatarData = await avatarRes.json();
        const avatarUrl = avatarData.data[0].imageUrl;

        res.json({ success: true, id: userId, username: username, avatar: avatarUrl });
    } catch (err) {
        res.json({ error: "Erro ao consultar a API do Roblox." });
    }
});

// --- WHITELIST & SCRIPT LUA ---
app.get('/api/whitelist_add', (req, res) => {
    const { id, session_id } = req.query;
    if (!sessions[session_id] || sessions[session_id].step < 2) {
        return res.json({ error: "Missões não concluídas de forma legítima." });
    }
    
    whitelist[id] = Date.now() + KEY_DURATION_24H;
    res.json({ success: true });
});

app.get('/api/check_whitelist', (req, res) => {
    const { id } = req.query;
    const expireTime = whitelist[id];
    
    if (expireTime && Date.now() < expireTime) {
        return res.json({ valid: true });
    }
    if (expireTime) delete whitelist[id];
    res.json({ valid: false, error: "Seu acesso de 24h expirou ou não existe." });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
