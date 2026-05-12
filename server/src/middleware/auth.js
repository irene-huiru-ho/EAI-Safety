function requireResearcherAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.slice(7);
  const expected = process.env.RESEARCHER_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: 'RESEARCHER_PASSWORD not configured on server' });
  }

  if (token !== expected) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  next();
}

module.exports = { requireResearcherAuth };
