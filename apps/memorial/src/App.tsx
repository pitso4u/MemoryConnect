import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import MemorialPage from './pages/MemorialPage';
import ProjectorPage from './pages/ProjectorPage';

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineIndicator />
      <Routes>
        <Route path="/:slug/projector" element={<ProjectorPage />} />
        <Route path="/:slug" element={<MemorialPage />} />
        <Route path="/" element={
          <div className="min-h-screen flex items-center justify-center px-6">
            <div className="text-center">
              <h1 className="font-display text-3xl text-parchment mb-2">MemorialConnect</h1>
              <p className="text-parchment/50 text-sm">Scan the QR code to view a memorial</p>
            </div>
          </div>
        } />
      </Routes>
    </ErrorBoundary>
  );
}
