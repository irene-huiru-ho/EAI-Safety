const BoxSDK = require('box-node-sdk');
const fs = require('fs');
const path = require('path');

let client = null;

function getClient() {
  if (client) return client;

  const configPath = process.env.BOX_CONFIG_PATH;
  if (!configPath || !fs.existsSync(configPath)) {
    throw new Error(`Box config file not found at: ${configPath}. See README for setup instructions.`);
  }

  const boxConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const sdk = BoxSDK.getPreconfiguredInstance(boxConfig);
  client = sdk.getAppAuthClient('enterprise');
  return client;
}

async function getOrCreateFolder(parentFolderId, folderName) {
  const boxClient = getClient();
  try {
    const items = await boxClient.folders.getItems(parentFolderId, { fields: 'name,id,type' });
    const existing = items.entries.find(e => e.type === 'folder' && e.name === folderName);
    if (existing) return existing.id;
  } catch (err) {
    if (err.statusCode !== 404) throw err;
  }

  const created = await boxClient.folders.create(parentFolderId, folderName);
  return created.id;
}

async function uploadImage(folderId, filename, buffer) {
  const boxClient = getClient();
  const stream = require('stream');
  const readable = new stream.PassThrough();
  readable.end(buffer);
  const uploaded = await boxClient.files.uploadFile(folderId, filename, readable);
  return uploaded.entries[0];
}

async function uploadJSON(folderId, filename, data) {
  const boxClient = getClient();
  const stream = require('stream');
  const readable = new stream.PassThrough();
  readable.end(JSON.stringify(data, null, 2));
  const uploaded = await boxClient.files.uploadFile(folderId, filename, readable);
  return uploaded.entries[0];
}

// Append a row to the summary CSV in the root study folder.
// Creates the file if it doesn't exist; appends a new version if it does (Box versioning).
async function updateSummaryCSV(rootFolderId, row) {
  const boxClient = getClient();
  const filename = 'all_submissions.csv';

  const headers = [
    'submission_id', 'participant_id', 'timestamp', 'image_filename',
    'severity', 'significance',
    ...Object.keys(row.answers || {}).map(k => `q_${k}`),
    'notes'
  ];

  const csvRow = [
    row.submissionId, row.participantId, row.timestamp, row.imageFilename,
    row.severity, row.significance,
    ...Object.values(row.answers || {}),
    row.notes || ''
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');

  try {
    const items = await boxClient.folders.getItems(rootFolderId, { fields: 'name,id,type' });
    const existing = items.entries.find(e => e.type === 'file' && e.name === filename);

    if (existing) {
      // Download existing, append row, re-upload as new version
      const existingStream = await boxClient.files.getReadStream(existing.id);
      const existingContent = await streamToString(existingStream);
      const updated = existingContent.trim() + '\n' + csvRow + '\n';

      const stream = require('stream');
      const readable = new stream.PassThrough();
      readable.end(updated);
      await boxClient.files.uploadNewFileVersion(existing.id, readable);
    } else {
      // Create new CSV with headers
      const content = headers.join(',') + '\n' + csvRow + '\n';
      const stream = require('stream');
      const readable = new stream.PassThrough();
      readable.end(content);
      await boxClient.files.uploadFile(rootFolderId, filename, readable);
    }
  } catch (err) {
    // Non-fatal: log but don't fail the submission
    console.error('Failed to update summary CSV:', err.message);
  }
}

async function getFolders(parentFolderId) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(parentFolderId, { fields: 'name,id,type' });
  return items.entries.filter(e => e.type === 'folder');
}

async function getJSON(folderId, filename) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(folderId, { fields: 'name,id,type' });
  const file = items.entries.find(e => e.type === 'file' && e.name === filename);
  if (!file) throw new Error(`File ${filename} not found in folder ${folderId}`);

  const stream = await boxClient.files.getReadStream(file.id);
  const text = await streamToString(stream);
  return JSON.parse(text);
}

async function getImageUrl(folderId, filename) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(folderId, { fields: 'name,id,type' });
  const file = items.entries.find(e => e.type === 'file' && e.name === filename);
  if (!file) throw new Error(`File ${filename} not found in folder ${folderId}`);

  return await boxClient.files.getDownloadURL(file.id);
}

// Returns a list of participant folder names and their IDs
async function listParticipants(rootFolderId) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(rootFolderId, { fields: 'name,id,type' });
  return items.entries
    .filter(e => e.type === 'folder' && e.name.startsWith('Participant_'))
    .map(e => ({ name: e.name, id: e.id, participantId: e.name.replace('Participant_', '') }));
}

// Returns submission folders within a participant folder
async function listSubmissions(participantFolderId) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(participantFolderId, { fields: 'name,id,type' });
  const submissions = items.entries.filter(e => e.type === 'folder' && e.name.startsWith('Submission_'));

  const result = [];
  for (const sub of submissions) {
    const subItems = await boxClient.folders.getItems(sub.id, { fields: 'name,id,type' });
    const responseFile = subItems.entries.find(e => e.name === 'response.json');
    const imageFile = subItems.entries.find(e => e.name === 'image.jpg');

    let responseData = null;
    if (responseFile) {
      try {
        const stream = await boxClient.files.getReadStream(responseFile.id);
        const text = await streamToString(stream);
        responseData = JSON.parse(text);
      } catch {}
    }

    result.push({
      folderName: sub.name,
      folderId: sub.id,
      imageFileId: imageFile?.id ?? null,
      responseData
    });
  }

  return result;
}

async function getImageDownloadUrl(fileId) {
  const boxClient = getClient();
  // Returns a temporary download URL for the image
  const url = await boxClient.files.getDownloadURL(fileId);
  return url;
}

async function getSummaryCSV(rootFolderId) {
  const boxClient = getClient();
  const items = await boxClient.folders.getItems(rootFolderId, { fields: 'name,id,type' });
  const csvFile = items.entries.find(e => e.type === 'file' && e.name === 'all_submissions.csv');
  if (!csvFile) return null;
  const stream = await boxClient.files.getReadStream(csvFile.id);
  return streamToString(stream);
}

module.exports = {
  getOrCreateFolder,
  uploadImage,
  uploadJSON,
  updateSummaryCSV,
  listParticipants,
  listSubmissions,
  getImageDownloadUrl,
  getSummaryCSV,
  getFolders,
  getJSON,
  getImageUrl
};
