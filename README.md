# Home Safety Study — Data Collection App

A mobile-first web app for collecting photos and structured responses from study participants about physical safety risks in their homes.

## Project Structure

```
home-safety-study/
├── client/          React frontend (Vite + Tailwind)
├── server/          Node.js/Express backend
└── README.md
```

---

## Part 1 — Google Drive Setup

This app uses the Google Drive API to upload photos and responses to your Google Drive account automatically.

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Drive API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Drive API" and enable it

### Step 2: Create a Service Account

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "Service Account"
3. Give it a name like `home-safety-study-service`
4. Grant it the "Editor" role (or create a custom role with Drive permissions)
5. Click "Done"

### Step 3: Generate Service Account Key

1. In the service account list, click on your new service account
2. Go to the "Keys" tab
3. Click "Add Key" > "Create new key" > "JSON"
4. This downloads a JSON file — rename it to `google-credentials.json`
5. Place `google-credentials.json` in the `server/` directory (it's gitignored)

### Step 4: Create a Root Study Folder in Google Drive

1. In Google Drive, create a folder called `Home_Safety_Study` (or whatever you prefer)
2. Right-click the folder > "Get shareable link"
3. Copy the folder ID from the URL:
   `https://drive.google.com/drive/folders/`**`XXXXXXXXXXXXXXXXXXXXX`**
4. Share the folder with your service account email (found in the JSON file as `client_email`)
5. Grant "Editor" access to the service account

> If you are using a Shared Drive instead of your personal My Drive, also share the folder or Shared Drive with the service account and set `GOOGLE_DRIVE_SHARED_DRIVE_ID` in your `.env`.

---

## Part 2 — Server Setup

```bash
cd server
cp .env.example .env
# Edit .env with your values
npm install
npm run dev
```

Your `.env` should look like:

```env
GOOGLE_CREDENTIALS_PATH=./google-credentials.json
GOOGLE_DRIVE_ROOT_FOLDER_ID=XXXXXXXXXXXXXXXXXXXXX          # your folder ID from Step 4
GOOGLE_DRIVE_SHARED_DRIVE_ID=YYYYYYYYYYYYYYYYYYYYYYYYYYYY  # optional shared drive ID if using a Shared Drive
RESEARCHER_PASSWORD=choose-a-strong-password
PORT=3003
CLIENT_URL=http://localhost:5173
```

---

## Part 3 — Client Setup

```bash
cd client
npm install
npm run dev
```

The app opens at [http://localhost:5173](http://localhost:5173)  
The researcher dashboard is at [http://localhost:5173/researcher](http://localhost:5173/researcher)

> If you need to change the backend port, update `client/vite.config.js` or set `BACKEND_URL` before starting the client.

---

## Customizing Study Questions

Edit `client/src/config/questions.js` — no other files need to change.

Each question has this shape:

```js
{
  id: 'unique_key',        // used as column name in CSV export
  type: 'text',            // 'text' | 'radio'
  label: 'Question text',
  required: true,
  options: ['Option A', 'Option B']  // only for 'radio' type
}
```

The rating scale labels and descriptions are also in that file under `RATINGS`.

---

## Google Drive Folder Structure

Each submission creates:

```
Home_Safety_Study/
  Participant_P001/
    Submission_2025-06-15T14-30-00/
      image.jpg
      response.json
  Participant_P002/
    ...
  all_submissions.csv    ← one row per submission, updated automatically
```

---

## Deployment (optional)

For a permanent URL participants can access on their phones:

1. Deploy the server to a Node.js host (Render, Railway, or a UW-Madison server)
2. Build the client: `cd client && npm run build`
3. Serve `client/dist` as static files from the same server, or deploy separately to Netlify/Vercel
4. Update `CLIENT_URL` in your server `.env` to the production frontend URL

---

## Researcher Dashboard

Navigate to `/researcher` and enter the `RESEARCHER_PASSWORD` from your `.env`.

- View all participants and their submission counts
- Browse individual submissions with photo + responses
- Download all data as a CSV with the **↓ CSV** button
