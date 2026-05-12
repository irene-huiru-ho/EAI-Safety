import { useState } from 'react';

export default function ParticipantEntry({ onStart }) {
  const [id, setId] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = id.trim().toUpperCase();
    if (!trimmed) {
      setError('Please enter your participant ID.');
      return;
    }
    if (!/^[A-Z0-9_-]{2,20}$/.test(trimmed)) {
      setError('ID must be 2–20 characters (letters, numbers, hyphens, underscores).');
      return;
    }
    onStart(trimmed);
  }

  return (
    <div className="min-h-screen flex flex-col justify-center p-6 max-w-md mx-auto">
      <div className="mb-8 text-center">
        <div className="text-5xl mb-4">🏠</div>
        <h1 className="text-2xl font-bold text-gray-900">Home Safety Study</h1>
        <p className="mt-2 text-gray-500 text-sm">
          Take photos of areas or objects you think may have physical interaction risks.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label htmlFor="pid" className="label">Participant ID</label>
          <input
            id="pid"
            className="input uppercase"
            type="text"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            placeholder="e.g. P001"
            value={id}
            onChange={e => { setId(e.target.value); setError(''); }}
          />
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>

        <button type="submit" className="btn-primary">
          Start Session
        </button>
      </form>

      <p className="mt-6 text-xs text-center text-gray-400">
        Your photos and responses will be securely uploaded to the research team.
      </p>
    </div>
  );
}
