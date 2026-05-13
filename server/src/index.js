require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const submissionsRouter = require('./routes/submissions');
const researcherRouter = require('./routes/researcher');

const app = express();
const PORT = process.env.PORT || 3003;
const isProd = process.env.NODE_ENV === 'production';

if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
} else {
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
}

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Login: validates password, returns it as the bearer token
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });
  if (password === process.env.RESEARCHER_PASSWORD) {
    return res.json({ success: true, token: password });
  }
  res.status(401).json({ error: 'Invalid password' });
});

app.use('/api/submissions', submissionsRouter);
app.use('/api/researcher', researcherRouter);

// Catch-all: serve React app for any non-API route (SPA routing)
if (isProd) {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
