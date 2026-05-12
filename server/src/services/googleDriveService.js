const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

let drive = null;
const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null;

function getDriveClient() {
  if (drive) return drive;

  const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
  if (!credentialsPath || !fs.existsSync(credentialsPath)) {
    throw new Error(`Google credentials file not found at: ${credentialsPath}. See README for setup instructions.`);
  }

  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  drive = google.drive({ version: 'v3', auth });
  return drive;
}

function getDriveListOptions() {
  const opts = {
    spaces: 'drive',
    includeItemsFromAllDrives: true,
    supportsAllDrives: true
  };

  if (sharedDriveId) {
    opts.driveId = sharedDriveId;
  }

  return opts;
}

async function getOrCreateFolder(parentFolderId, folderName) {
  const driveClient = getDriveClient();

  // Check if folder already exists
  const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    ...getDriveListOptions()
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  // Create new folder
  const fileMetadata = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentFolderId]
  };

  const folder = await driveClient.files.create({
    resource: fileMetadata,
    fields: 'id',
    supportsAllDrives: true
  });

  return folder.data.id;
}

async function uploadImage(folderId, filename, buffer) {
  const driveClient = getDriveClient();

  const fileMetadata = {
    name: filename,
    parents: [folderId]
  };

  const media = {
    mimeType: 'image/jpeg',
    body: Readable.from(buffer)
  };

  const response = await driveClient.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
    supportsAllDrives: true
  });

  return { id: response.data.id };
}

async function uploadJSON(folderId, filename, data) {
  const driveClient = getDriveClient();

  const fileMetadata = {
    name: filename,
    parents: [folderId]
  };

  const media = {
    mimeType: 'application/json',
    body: Readable.from(JSON.stringify(data, null, 2))
  };

  const response = await driveClient.files.create({
    resource: fileMetadata,
    media: media,
    fields: 'id',
    supportsAllDrives: true
  });

  return { id: response.data.id };
}

async function getFolders(parentFolderId) {
  const driveClient = getDriveClient();

  const query = `'${parentFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    orderBy: 'createdTime desc',
    ...getDriveListOptions()
  });

  return response.data.files.map(f => ({ id: f.id, name: f.name }));
}

async function getJSON(folderId, filename) {
  const driveClient = getDriveClient();

  // Find the file
  const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });

  if (response.data.files.length === 0) {
    throw new Error(`File ${filename} not found in folder ${folderId}`);
  }

  // Download the file
  const fileId = response.data.files[0].id;
  const downloadResponse = await driveClient.files.get({
    fileId: fileId,
    alt: 'media',
    supportsAllDrives: true
  });

  const fileData = downloadResponse.data;
  if (typeof fileData === 'string') {
    return JSON.parse(fileData);
  }

  if (fileData instanceof Buffer) {
    return JSON.parse(fileData.toString('utf8'));
  }

  if (fileData && typeof fileData === 'object') {
    return fileData;
  }

  throw new Error(`Unable to parse JSON response from file ${filename}`);
}

async function getImageUrl(folderId, filename) {
  const driveClient = getDriveClient();

  const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });

  if (response.data.files.length === 0) {
    throw new Error(`Image ${filename} not found in folder ${folderId}`);
  }

  const fileId = response.data.files[0].id;

  await driveClient.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    },
    supportsAllDrives: true
  });

  const result = await driveClient.files.get({
    fileId,
    fields: 'webContentLink',
    supportsAllDrives: true
  });

  return result.data.webContentLink;
}

async function updateSummaryCSV(rootFolderId, row) {
  const driveClient = getDriveClient();
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

  // Check if CSV file exists
  const query = `'${rootFolderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });

  if (response.data.files.length > 0) {
    // Update existing file
    const fileId = response.data.files[0].id;

    // Get existing content
    const existingResponse = await driveClient.files.get({
      fileId: fileId,
      alt: 'media'
    });
    const existingContent = existingResponse.data;

    // Append new row
    const updatedContent = existingContent.trim() + '\n' + csvRow + '\n';

    // Update file
    await driveClient.files.update({
      fileId: fileId,
      media: {
        mimeType: 'text/csv',
        body: Readable.from(updatedContent)
      },
      supportsAllDrives: true
    });
  } else {
    // Create new CSV
    const content = headers.join(',') + '\n' + csvRow + '\n';

    const fileMetadata = {
      name: filename,
      parents: [rootFolderId]
    };

    const media = {
      mimeType: 'text/csv',
      body: Readable.from(content)
    };

    await driveClient.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id',
      supportsAllDrives: true
    });
  }
}

async function listParticipants(rootFolderId) {
  const driveClient = getDriveClient();

  const query = `'${rootFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains 'Participant_' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    ...getDriveListOptions()
  });

  return response.data.files.map(f => ({
    name: f.name,
    id: f.id,
    participantId: f.name.replace('Participant_', '')
  }));
}

async function listSubmissions(participantFolderId) {
  const driveClient = getDriveClient();

  const query = `'${participantFolderId}' in parents and mimeType = 'application/vnd.google-apps.folder' and name contains 'Submission_' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    orderBy: 'createdTime desc',
    ...getDriveListOptions()
  });

  const submissions = [];

  for (const folder of response.data.files) {
    try {
      // Get response.json from each submission folder
      const responseData = await getJSON(folder.id, 'response.json');
      const imageUrl = await getImageUrl(await getImageFileId(folder.id, 'image.jpg'));

      submissions.push({
        folderName: folder.name,
        folderId: folder.id,
        imageFileId: await getImageFileId(folder.id, 'image.jpg'),
        responseData
      });
    } catch (err) {
      // Skip folders that don't have response.json
      console.warn(`Skipping submission folder ${folder.id}: ${err.message}`);
    }
  }

  return submissions;
}

async function getImageFileId(folderId, filename) {
  const driveClient = getDriveClient();

  const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });

  if (response.data.files.length === 0) {
    throw new Error(`File ${filename} not found in folder ${folderId}`);
  }

  return response.data.files[0].id;
}

async function getImageDownloadUrl(fileId) {
  const driveClient = getDriveClient();

  // Create a temporary public link
  await driveClient.permissions.create({
    fileId: fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    },
    supportsAllDrives: true
  });

  const result = await driveClient.files.get({
    fileId: fileId,
    fields: 'webContentLink',
    supportsAllDrives: true
  });

  return result.data.webContentLink;
}

async function streamFile(fileId, res) {
  const driveClient = getDriveClient();

  const downloadResponse = await driveClient.files.get(
    {
      fileId: fileId,
      alt: 'media',
      supportsAllDrives: true
    },
    { responseType: 'stream' }
  );

  const contentType = downloadResponse.headers?.['content-type'] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);

  return new Promise((resolve, reject) => {
    downloadResponse.data
      .on('end', resolve)
      .on('error', reject)
      .pipe(res);
  });
}

async function getSummaryCSV(rootFolderId) {
  const driveClient = getDriveClient();

  const query = `'${rootFolderId}' in parents and name = 'all_submissions.csv' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });

  if (response.data.files.length === 0) return null;

  const fileId = response.data.files[0].id;
  const downloadResponse = await driveClient.files.get({
    fileId: fileId,
    alt: 'media',
    supportsAllDrives: true
  });

  return downloadResponse.data;
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
  getImageUrl,
  getImageFileId,
  streamFile
};