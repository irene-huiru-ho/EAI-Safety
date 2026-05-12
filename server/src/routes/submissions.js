const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const drive = require('../services/googleDriveService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/submissions/image/:fileId - Proxy an image download through the backend
router.get('/image/:fileId', async (req, res) => {
  try {
    const fileId = req.params.fileId;
    await drive.streamFile(fileId, res);
  } catch (err) {
    console.error('Error proxying image:', err);
    res.status(500).send('Image proxy failed');
  }
});

// GET /api/submissions/:participantId - Retrieve all submissions for a participant
router.get('/:participantId', async (req, res) => {
  try {
    const { participantId } = req.params;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    // Get participant folder
    const participantFolderId = await drive.getOrCreateFolder(rootFolderId, `Participant_${participantId}`);

    // Get all submission folders
    const submissionFolders = await drive.getFolders(participantFolderId);

    const submissions = [];

    for (const folder of submissionFolders) {
      try {
        // Get response.json from each submission folder
        const responseData = await drive.getJSON(folder.id, 'response.json');
        const imageFileId = await drive.getImageFileId(folder.id, 'image.jpg');
        const imageUrl = `/api/submissions/image/${imageFileId}`;

        submissions.push({
          id: responseData.submissionId,
          participantId: responseData.participantId,
          timestamp: responseData.timestamp,
          severity: responseData.severity,
          significance: responseData.significance,
          notes: responseData.notes,
          answers: responseData.answers,
          status: responseData.status || 'submitted', // Default to submitted for existing data
          imageUrl,
          folderId: folder.id
        });
      } catch (err) {
        // Skip folders that don't have response.json (corrupted submissions)
        console.warn(`Skipping submission folder ${folder.id}: ${err.message}`);
      }
    }

    // Sort by timestamp, newest first
    submissions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    res.json({ submissions });
  } catch (err) {
    console.error('Error retrieving submissions:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/', upload.single('image'), async (req, res) => {
  try {
    const { participantId, severity, significance, notes, answers, status = 'draft' } = req.body;

    if (!participantId || !req.file) {
      return res.status(400).json({ error: 'participantId and image are required' });
    }

    const submissionId = uuidv4();
    const timestamp = new Date().toISOString();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    // Create folder hierarchy: RootFolder / Participant_{id} / Submission_{submissionId}/
    const participantFolderId = await drive.getOrCreateFolder(rootFolderId, `Participant_${participantId}`);
    const label = timestamp.replace(/[:.]/g, '-').slice(0, 19);
    const submissionFolderId = await drive.getOrCreateFolder(participantFolderId, `Submission_${label}`);

    // Upload image
    const imageFilename = 'image.jpg';
    await drive.uploadImage(submissionFolderId, imageFilename, req.file.buffer);

    // Parse answers (sent as JSON string from the form)
    let parsedAnswers = {};
    try { parsedAnswers = JSON.parse(answers || '{}'); } catch {}

    // Build response document
    const responseData = {
      submissionId,
      participantId,
      timestamp,
      severity: Number(severity),
      significance: Number(significance),
      notes: notes || '',
      answers: parsedAnswers,
      status // 'draft' or 'submitted'
    };

    await drive.uploadJSON(submissionFolderId, 'response.json', responseData);

    // Only update summary CSV for submitted photos
    if (status === 'submitted') {
      await drive.updateSummaryCSV(rootFolderId, { ...responseData, imageFilename });
    }

    res.json({ success: true, submissionId });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/submissions/:participantId/submit - Mark all draft submissions as submitted
router.put('/:participantId/submit', async (req, res) => {
  try {
    const { participantId } = req.params;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    // Get participant folder
    const participantFolderId = await drive.getOrCreateFolder(rootFolderId, `Participant_${participantId}`);

    // Get all submission folders
    const submissionFolders = await drive.getFolders(participantFolderId);

    const submittedIds = [];

    for (const folder of submissionFolders) {
      try {
        // Get current response.json
        const responseData = await drive.getJSON(folder.id, 'response.json');

        // If it's a draft, mark as submitted and update CSV
        if (responseData.status === 'draft') {
          responseData.status = 'submitted';
          await drive.uploadJSON(folder.id, 'response.json', responseData);
          await drive.updateSummaryCSV(rootFolderId, { ...responseData, imageFilename: 'image.jpg' });
          submittedIds.push(responseData.submissionId);
        }
      } catch (err) {
        console.warn(`Error updating submission ${folder.id}: ${err.message}`);
      }
    }

    res.json({ success: true, submittedCount: submittedIds.length, submittedIds });
  } catch (err) {
    console.error('Error submitting drafts:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
