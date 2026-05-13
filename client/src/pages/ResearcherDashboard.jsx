import { useState, useEffect, useCallback } from 'react';

function useToken() {
  const [token, setToken] = useState(() => sessionStorage.getItem('researcher_token') || '');
  const save = (t) => { sessionStorage.setItem('researcher_token', t); setToken(t); };
  const clear = () => { sessionStorage.removeItem('researcher_token'); setToken(''); };
  return { token, save, clear };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// ─── Login Screen ────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center p-6 max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-3">🔬</div>
        <h1 className="text-2xl font-bold">Researcher Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Home Safety Study</p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Researcher Password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

// ─── Participant List ────────────────────────────────────────
function ParticipantList({ token, onSelect }) {
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/researcher/participants', { headers: authHeaders(token) })
      .then(r => r.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setParticipants(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return <LoadingSpinner label="Loading participants..." />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">Participants ({participants.length})</h2>
      {participants.length === 0 ? (
        <p className="text-gray-500 text-sm">No submissions yet.</p>
      ) : (
        <div className="space-y-2">
          {participants.map(p => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className="w-full text-left card flex items-center justify-between hover:shadow-md transition-shadow active:bg-gray-50"
            >
              <div>
                <p className="font-semibold">{p.participantId}</p>
                <p className="text-xs text-gray-400 mt-0.5">Google Drive folder: {p.name}</p>
              </div>
              <span className="text-blue-500 text-lg">→</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Submission List for a participant ──────────────────────
function SubmissionList({ token, participant, onBack, onSelectSubmission }) {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSubmissions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/researcher/submissions/${participant.id}`, { headers: authHeaders(token) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load submissions');
      setSubmissions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [participant.id, token]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  if (loading) return <LoadingSpinner label="Loading submissions..." />;
  if (error) return <ErrorMsg msg={error} />;

  return (
    <div>
      <div className="flex items-center justify-between gap-4 mb-4">
        <button onClick={onBack} className="text-blue-600 text-sm">← All Participants</button>
        <button onClick={loadSubmissions} className="text-sm text-blue-600 underline">
          Refresh List
        </button>
      </div>
      <h2 className="text-lg font-semibold mb-3">
        {participant.participantId} — {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
      </h2>
      {submissions.length === 0 ? (
        <p className="text-gray-500 text-sm">No submissions found.</p>
      ) : (
        <div className="space-y-2">
          {submissions.map(sub => (
            <button
              key={sub.imageFileId || sub.folderName}
              onClick={() => onSelectSubmission(sub)}
              className="w-full text-left card hover:shadow-md transition-shadow active:bg-gray-50"
            >
              <p className="font-medium text-sm">{sub.folderName}</p>
              {sub.responseData && (
                <div className="flex flex-wrap gap-4 mt-1 text-xs text-gray-500">
                  <span>Severity: <strong>{sub.responseData.severity}/5</strong></span>
                  <span>Significance: <strong>{sub.responseData.significance}/5</strong></span>
                  <span>File: <strong>{sub.responseData.imageFilename || 'image.jpg'}</strong></span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Single Submission Detail ────────────────────────────────
function SubmissionDetail({ token, submission, onBack }) {
  const { responseData, imageFileId } = submission;

  return (
    <div>
      <button onClick={onBack} className="text-blue-600 text-sm mb-4">← Back</button>

      {imageFileId && (
        <div className="mb-4 rounded-2xl overflow-hidden">
          <img
            src={`/api/researcher/image/${imageFileId}`}
            alt="Submission"
            className="w-full object-cover max-h-72"
          />
        </div>
      )}

      {responseData ? (
        <div className="space-y-3">
          <div className="rounded-2xl px-4 py-3 bg-gray-50 text-sm text-gray-600">
            <p><span className="font-semibold">Image file:</span> {responseData.imageFilename || 'image.jpg'}</p>
            <p><span className="font-semibold">Response file:</span> {responseData.responseFilename || 'response.json'}</p>
          </div>
          <div className="card grid grid-cols-2 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">Severity</p>
              <p className="text-3xl font-bold text-blue-600">{responseData.severity}<span className="text-sm text-gray-400">/5</span></p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Significance</p>
              <p className="text-3xl font-bold text-blue-600">{responseData.significance}<span className="text-sm text-gray-400">/5</span></p>
            </div>
          </div>

          {responseData.answers && Object.keys(responseData.answers).length > 0 && (
            <div className="card space-y-3">
              <p className="font-semibold">Responses</p>
              {Object.entries(responseData.answers).map(([key, val]) => (
                <div key={key}>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">{key.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-gray-900 mt-0.5">{val}</p>
                </div>
              ))}
            </div>
          )}

          {responseData.notes && (
            <div className="card">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-gray-900">{responseData.notes}</p>
            </div>
          )}

          <div className="card">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Metadata</p>
            <p className="text-xs text-gray-600">ID: {responseData.submissionId}</p>
            <p className="text-xs text-gray-600">Timestamp: {new Date(responseData.timestamp).toLocaleString()}</p>
            <p className="text-xs text-gray-600">Participant: {responseData.participantId}</p>
          </div>
        </div>
      ) : (
        <p className="text-gray-500 text-sm">No response data found.</p>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function LoadingSpinner({ label }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-3" />
      <p className="text-sm">{label}</p>
    </div>
  );
}
function ErrorMsg({ msg }) {
  return <p className="text-red-600 text-sm bg-red-50 p-4 rounded-xl">{msg}</p>;
}

// ─── Main Dashboard ──────────────────────────────────────────
export default function ResearcherDashboard() {
  const { token, save: saveToken, clear: clearToken } = useToken();
  const [view, setView] = useState('list'); // 'list' | 'submissions' | 'detail'
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/researcher/export', { headers: authHeaders(token) });
      if (!res.ok) { alert('No data to export yet.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'home_safety_study_export.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  if (!token) return <LoginScreen onLogin={saveToken} />;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-bold text-gray-900">Research Dashboard</h1>
          <div className="flex gap-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="text-sm px-3 py-1.5 bg-green-600 text-white rounded-lg active:bg-green-700 disabled:opacity-50"
            >
              {exporting ? 'Exporting...' : '↓ CSV'}
            </button>
            <button
              onClick={clearToken}
              className="text-sm px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg active:bg-gray-200"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4">
        {view === 'list' && (
          <ParticipantList
            token={token}
            onSelect={p => { setSelectedParticipant(p); setView('submissions'); }}
          />
        )}
        {view === 'submissions' && selectedParticipant && (
          <SubmissionList
            token={token}
            participant={selectedParticipant}
            onBack={() => setView('list')}
            onSelectSubmission={sub => { setSelectedSubmission(sub); setView('detail'); }}
          />
        )}
        {view === 'detail' && selectedSubmission && (
          <SubmissionDetail
            token={token}
            submission={selectedSubmission}
            onBack={() => setView('submissions')}
          />
        )}
      </div>
    </div>
  );
}
