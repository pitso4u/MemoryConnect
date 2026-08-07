import { Routes, Route } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineIndicator } from './components/OfflineIndicator';
import HomePage from './pages/HomePage';
import MemorialPage from './pages/MemorialPage';
import ProjectorPage from './pages/ProjectorPage';
import FuneralHomeServicesPage from './pages/FuneralHomeServicesPage';
import BrochurePage from './pages/BrochurePage';

export default function App() {
  return (
    <ErrorBoundary>
      <OfflineIndicator />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/fh/:slug" element={<FuneralHomeServicesPage />} />
        <Route path="/services/:fhSlug/:slug" element={<BrochurePage />} />
        <Route path="/services/:slug" element={<BrochurePage />} />
        <Route path="/:slug/projector" element={<ProjectorPage />} />
        <Route path="/:slug" element={<MemorialPage />} />
      </Routes>
    </ErrorBoundary>
  );
}
