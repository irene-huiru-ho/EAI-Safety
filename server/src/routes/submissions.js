const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const drive = require('../services/googleDriveService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// GET /api/submissions/image/:fileId - Proxy the image bytes through the backend
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

    // Only look up the folder — don't create it here to avoid duplicate folders on concurrent loads
    const participantFolderId = await drive.findFolder(rootFolderId, `Participant_${participantId}`);
    if (!participantFolderId) {
      return res.json({ submissions: [] });
    }

    const submissionsData = await drive.listSubmissions(participantFolderId);

    const submissions = submissionsData.map(sub => {
      const imageUrl = `/api/submissions/image/${sub.imageFileId}`;
      return {
        id: sub.responseData.submissionId,
        participantId: sub.responseData.participantId,
        timestamp: sub.responseData.timestamp,
        severity: sub.responseData.severity,
        significance: sub.responseData.significance,
        notes: sub.responseData.notes,
        answers: sub.responseData.answers,
        status: sub.responseData.status || 'submitted',
        imageUrl,
        folderId: sub.folderId,
        folderName: sub.folderName,
        imageFilename: sub.responseData.imageFilename,
        imageFileId: sub.imageFileId,
        responseFilename: sub.responseData.responseFilename
      };
    });

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
    const { participantId, severity, significance, notes, answers, status = 'draft', oldImageFileId } = req.body;

    if (!participantId || !req.file) {
      return res.status(400).json({ error: 'participantId and image are required' });
    }

    const submissionId = uuidv4();
    const timestamp = new Date().toISOString();
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    // Get participant folder (no subfolder for submissions)
    const participantFolderId = await drive.getOrCreateFolder(rootFolderId, `Participant_${participantId}`);

    // If editing an existing draft, rename old files to mark them as superseded
    if (oldImageFileId) {
      try {
        const oldImageFilename = await drive.getFileName(oldImageFileId);
        const oldResponseFilename = oldImageFilename.replace('.jpg', '.json');
        await drive.renameFile(oldImageFileId, `edited_${oldImageFilename}`);
        const oldResponseFileId = await drive.getFileId(participantFolderId, oldResponseFilename);
        await drive.renameFile(oldResponseFileId, `edited_${oldResponseFilename}`);
      } catch (err) {
        console.warn('Could not rename old draft during edit:', err.message);
      }
    }

    // Get current submitted count
    const existingSubmissions = await drive.listSubmissions(participantFolderId);
    const submittedCount = existingSubmissions.filter(sub => sub.responseData.status === 'submitted').length;

    // Use sequential filename for submitted, temporary for drafts
    let imageFilename;
    let responseFilename;
    if (status === 'submitted') {
      const nextImageNumber = submittedCount + 1;
      imageFilename = `${participantId}_image_${nextImageNumber}.jpg`;
      responseFilename = `${participantId}_response_${nextImageNumber}.json`;
    } else {
      imageFilename = `${submissionId}.jpg`;
      responseFilename = `${submissionId}.json`;
    }

    const { id: imageFileId } = await drive.uploadImage(participantFolderId, imageFilename, req.file.buffer);

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
      imageFilename,
      responseFilename,
      status // 'draft' or 'submitted'
    };

    await drive.uploadJSON(participantFolderId, responseFilename, responseData);

    // Only update summary CSV for submitted photos
    if (status === 'submitted') {
      await drive.updateSummaryCSV(rootFolderId, responseData);
    }

    res.json({ success: true, submissionId, folderId: participantFolderId, imageFilename, responseFilename, imageFileId });
  } catch (err) {
    console.error('Submission error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/submissions/:participantId/:imageFileId - Remove a draft submission
router.delete('/:participantId/:imageFileId', async (req, res) => {
  try {
    const { participantId, imageFileId } = req.params;
    const rootFolderId = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID;

    const participantFolderId = await drive.getOrCreateFolder(rootFolderId, `Participant_${participantId}`);

    // Get file name
    const imageFilename = await drive.getFileName(imageFileId);
    let responseFilename;

    const match = imageFilename.match(/^(.+)_image_(\d+)\.jpg$/);
    if (match) {
      responseFilename = `${match[1]}_response_${match[2]}.json`;
    } else {
      responseFilename = imageFilename.replace('.jpg', '.json');
    }

    // Look up response file BEFORE renaming the image so a lookup failure
    // leaves both files at their original names (clean state for retry).
    const responseFileId = await drive.getFileId(participantFolderId, responseFilename);

    // Soft-delete: rename files instead of hard-deleting for traceability
    await drive.renameFile(imageFileId, `deleted_${imageFilename}`);
    await drive.renameFile(responseFileId, `deleted_${responseFilename}`);

    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting submission:', err);
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

    // Get all submissions
    const submissionsData = await drive.listSubmissions(participantFolderId);

    // Get current submitted count
    const submittedCount = submissionsData.filter(sub => sub.responseData.status === 'submitted').length;

    // Collect drafts
    const draftsToSubmit = submissionsData.filter(sub => sub.responseData.status === 'draft');

    // Sort drafts by timestamp
    draftsToSubmit.sort((a, b) => new Date(a.responseData.timestamp) - new Date(b.responseData.timestamp));

    const submittedIds = [];

    // Process each draft: mark submitted, rename files, update JSON and CSV
    for (const sub of draftsToSubmit) {
      const currentCount = submittedCount + submittedIds.length + 1;
      const newImageFilename = `${participantId}_image_${currentCount}.jpg`;
      const newResponseFilename = `${participantId}_response_${currentCount}.json`;
      const oldResponseFilename = sub.responseData.responseFilename;
      // Use the responseFileId captured during listSubmissions — same files.list
      // result used for both reading and deletion, avoiding stale-index mismatches.
      const responseFileId = sub.responseFileId;

      await drive.renameFile(sub.imageFileId, newImageFilename);
      await drive.deleteFile(responseFileId);

      sub.responseData.status = 'submitted';
      sub.responseData.imageFilename = newImageFilename;
      sub.responseData.responseFilename = newResponseFilename;
      await drive.uploadJSON(participantFolderId, newResponseFilename, sub.responseData);
      await drive.updateSummaryCSV(rootFolderId, sub.responseData);

      submittedIds.push(sub.responseData.submissionId);
    }

    res.json({ success: true, submittedCount: submittedIds.length, submittedIds });
  } catch (err) {
    console.error('Error submitting drafts:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
