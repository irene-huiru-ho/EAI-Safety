const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');

let drive = null;
const sharedDriveId = process.env.GOOGLE_DRIVE_SHARED_DRIVE_ID || null;

function getDriveClient() {
  if (drive) return drive;

  let credentials;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else {
    const credentialsPath = process.env.GOOGLE_CREDENTIALS_PATH;
    if (!credentialsPath || !fs.existsSync(credentialsPath)) {
      throw new Error(`Google credentials not found. Set GOOGLE_CREDENTIALS_JSON or GOOGLE_CREDENTIALS_PATH.`);
    }
    credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
  }

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
    supportsAllDrives: true,
    pageSize: 1000
  };

  if (sharedDriveId) {
    opts.driveId = sharedDriveId;
    opts.corpora = 'drive';
  }

  return opts;
}

async function findFolder(parentFolderId, folderName) {
  const driveClient = getDriveClient();
  const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    orderBy: 'createdTime asc',
    ...getDriveListOptions()
  });
  return response.data.files.length > 0 ? response.data.files[0].id : null;
}

async function getFileId(folderId, filename) {
  const driveClient = getDriveClient();
  const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id)',
    ...getDriveListOptions()
  });
  if (response.data.files.length === 0) {
    throw new Error(`File '${filename}' not found in folder ${folderId}`);
  }
  return response.data.files[0].id;
}

async function getOrCreateFolder(parentFolderId, folderName) {
  const driveClient = getDriveClient();

  // Check if folder already exists
  const query = `'${parentFolderId}' in parents and name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id, name)',
    orderBy: 'createdTime asc',
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
    orderBy: 'createdTime desc',
    ...getDriveListOptions()
  });

  if (response.data.files.length === 0) {
    throw new Error(`File ${filename} not found in folder ${folderId}`);
  }

  // Download the file — use the most recent version if duplicates exist
  const fileId = response.data.files[0].id;
  const downloadResponse = await driveClient.files.get({
    fileId: fileId,
    alt: 'media',
    supportsAllDrives: true
  });

  const fileData = downloadResponse.data;
  if (typeof fileData === 'string') {
    return { data: JSON.parse(fileData), fileId };
  }

  if (fileData instanceof Buffer) {
    return { data: JSON.parse(fileData.toString('utf8')), fileId };
  }

  if (fileData && typeof fileData === 'object') {
    return { data: fileData, fileId };
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
      alt: 'media',
      supportsAllDrives: true
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

  // List all files in participant folder
  const response = await driveClient.files.list({
    q: `'${participantFolderId}' in parents and trashed = false`,
    fields: 'files(id, name)',
    orderBy: 'createdTime desc',
    ...getDriveListOptions()
  });

  const submissions = [];

  for (const file of response.data.files) {
    if (!file.name.endsWith('.jpg')) continue;
    if (file.name.startsWith('deleted_') || file.name.startsWith('edited_')) continue;

    try {
      let responseFilename;
      const match = file.name.match(/^(.+)_image_(\d+)\.jpg$/);
      if (match) {
        responseFilename = `${match[1]}_response_${match[2]}.json`;
      } else {
        // Assume draft with uuid.jpg -> uuid.json
        responseFilename = file.name.replace('.jpg', '.json');
      }

      const { data: responseData, fileId: responseFileId } = await getJSON(participantFolderId, responseFilename);

      submissions.push({
        folderName: file.name,
        folderId: participantFolderId,
        imageFileId: file.id,
        responseFileId,
        responseData
      });
    } catch (err) {
      // Skip files without matching response.json
      console.warn(`Skipping file ${file.id}: ${err.message}`);
    }
  }

  return submissions;
}

async function getImageFileId(folderId, filename) {
  const driveClient = getDriveClient();

  const query = `'${folderId}' in parents and name = '${filename}' and trashed = false`;
  const response = await driveClient.files.list({
    q: query,
    fields: 'files(id,name)',
    ...getDriveListOptions()
  });

  if (response.data.files.length > 0) {
    return response.data.files[0].id;
  }

  if (filename !== 'image.jpg') {
    const fallbackQuery = `'${folderId}' in parents and name = 'image.jpg' and trashed = false`;
    const fallbackResponse = await driveClient.files.list({
      q: fallbackQuery,
      fields: 'files(id,name)',
      ...getDriveListOptions()
    });

    if (fallbackResponse.data.files.length > 0) {
      return fallbackResponse.data.files[0].id;
    }
  }

  throw new Error(`File ${filename} not found in folder ${folderId}`);
}

async function deleteFolder(folderId) {
  const driveClient = getDriveClient();
  await driveClient.files.delete({
    fileId: folderId,
    supportsAllDrives: true
  });
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
  res.setHeader('Content-Disposition', 'inline');

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

async function renameFile(fileId, newName) {
  const driveClient = getDriveClient();
  await driveClient.files.update({
    fileId,
    requestBody: { name: newName },
    supportsAllDrives: true
  });
}

async function deleteFile(fileId) {
  const driveClient = getDriveClient();
  try {
    await driveClient.files.delete({
      fileId,
      supportsAllDrives: true
    });
  } catch (err) {
    if (err.code === 404 || err.response?.status === 404) return;
    throw err;
  }
}

async function getFileName(fileId) {
  const driveClient = getDriveClient();
  const response = await driveClient.files.get({
    fileId,
    fields: 'name',
    supportsAllDrives: true
  });
  return response.data.name;
}

module.exports = {
  findFolder,
  getFileId,
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
  deleteFolder,
  streamFile,
  renameFile,
  deleteFile,
  getFileName
};