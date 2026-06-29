import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import HomePage from './pages/HomePage';
import MemorialPage from './pages/MemorialPage';
import ProjectorPage from './pages/ProjectorPage';

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/:slug/projector" element={<ProjectorPage />} />
        <Route path="/:slug" element={<MemorialPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
