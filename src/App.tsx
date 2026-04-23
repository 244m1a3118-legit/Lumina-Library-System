import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from '@/src/pages/LandingPage';
import LoginPage from '@/src/pages/LoginPage';
import AdminDashboard from '@/src/pages/admin/AdminDashboard';
import LibrarianDashboard from '@/src/pages/librarian/LibrarianDashboard';
import FacultyDashboard from '@/src/pages/faculty/FacultyDashboard';
import StudentAccount from '@/src/pages/student/StudentAccount';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/src/lib/AuthContext';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/librarian" element={<LibrarianDashboard />} />
          <Route path="/faculty" element={<FacultyDashboard />} />
          <Route path="/student" element={<StudentAccount />} />
        </Routes>
        <Toaster />
      </Router>
    </AuthProvider>
  );
}
