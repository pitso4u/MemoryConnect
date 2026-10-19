import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PublicEventPage from './pages/PublicEventPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import EventEditorPage from './pages/EventEditorPage';
import PlatformPage from './pages/PlatformPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/platform" element={<PlatformPage />} />
      <Route path="/events/new" element={<EventEditorPage isNewRoute />} />
      <Route path="/events/:id" element={<EventEditorPage />} />
      <Route path="/preview/:id" element={<PublicEventPage />} />
      <Route path="/:slug" element={<PublicEventPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
