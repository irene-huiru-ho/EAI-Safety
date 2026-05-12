const express = require('express');
const { requireResearcherAuth } = require('../middleware/auth');
const drive = require('../services/googleDriveService');

const router = express.Router();
router.use(requireResearcherAuth);

// POST /api/researcher/login — just validates credentials
router.post('/login', (req, res) => {
  res.json({ success: true });
});

// GET /api/researcher/participants
router.get('/participants', async (req, res) => {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const participants = await drive.listParticipants(rootFolderId);
    res.json(participants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/researcher/submissions/:participantFolderId
router.get('/submissions/:participantFolderId', async (req, res) => {
  try {
    const submissions = await drive.listSubmissions(req.params.participantFolderId);
    res.json(submissions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/researcher/image/:fileId — proxies image from Google Drive
router.get('/image/:fileId', async (req, res) => {
  try {
    const url = await drive.getImageDownloadUrl(req.params.fileId);
    res.redirect(url);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/researcher/export — download CSV
router.get('/export', async (req, res) => {
  try {
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;
    const csv = await drive.getSummaryCSV(rootFolderId);
    if (!csv) return res.status(404).json({ error: 'No submissions yet' });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="home_safety_study_export.csv"');
    res.send(csv);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
