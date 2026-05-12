import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import ParticipantEntry from './components/ParticipantEntry';
import ParticipantFlow from './pages/ParticipantFlow';
import ResearcherDashboard from './pages/ResearcherDashboard';

function ParticipantApp() {
  const [participantId, setParticipantId] = useState(null);

  if (!participantId) {
    return <ParticipantEntry onStart={setParticipantId} />;
  }

  return (
    <ParticipantFlow
      participantId={participantId}
      onExit={() => setParticipantId(null)}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ParticipantApp />} />
        <Route path="/researcher" element={<ResearcherDashboard />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
