import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import React, { useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { HomePage } from './pages/HomePage';
import { QRScanPage } from './pages/QRScanPage';
import NotificationPage from './pages/NotificationPage';
import { UserDashboard } from './pages/UserDashboard';
import { AdminPage } from './pages/AdminPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { LoginPage } from './pages/LoginPage';
import { LoginSuccessPage } from './pages/LoginSuccessPage';
import { I18nextProvider } from 'react-i18next';
import i18n from './i18n'; // Import i18n configuration


// PWA detection component
function PWADetector({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone = (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://')
    );
    // Check if user has token
    const token = localStorage.getItem('userToken') || localStorage.getItem('token');
    // If running as PWA and user has token, and we are on root, redirect to dashboard
    if (standalone && token && window.location.pathname === '/') {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);
  return <>{children}</>;
}

function App() {

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <Router>
          <PWADetector>
            <div className="h-[100dvh] bg-gray-50 dark:bg-gray-900 flex flex-col overflow-hidden">
              <Header />
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/login-success" element={<LoginSuccessPage />} />
                <Route path="/qr" element={<QRScanPage />} />
                <Route path="/qr/:token" element={<QRScanPage />} />
                <Route path="/notify" element={<NotificationPage />} />
                <Route path="/notify/:token" element={<NotificationPage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
                <Route path="/dashboard/notifications" element={<NotificationsPage />} />
                <Route path="/user/:id" element={<UserDashboard />} />
                <Route path="/user/:id/notifications" element={<NotificationsPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
              </div>
            <Toaster
              position="top-center"
              toastOptions={{
                duration: 4000,
                style: {
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: '#fff',
                  fontSize: '16px',
                  fontWeight: '500',
                  borderRadius: '12px',
                  padding: '16px 20px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  backdropFilter: 'blur(10px)',
                },
                success: {
                  duration: 3000,
                  iconTheme: {
                    primary: '#10b981',
                    secondary: '#fff',
                  },
                  style: {
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '500',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 10px 25px rgba(16, 185, 129, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                  },
                },
                error: {
                  duration: 5000,
                  iconTheme: {
                    primary: '#ef4444',
                    secondary: '#fff',
                  },
                  style: {
                    background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '500',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 10px 25px rgba(239, 68, 68, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                  },
                },
                loading: {
                  duration: 10000,
                  iconTheme: {
                    primary: '#3b82f6',
                    secondary: '#fff',
                  },
                  style: {
                    background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                    color: '#fff',
                    fontSize: '16px',
                    fontWeight: '500',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    boxShadow: '0 10px 25px rgba(59, 130, 246, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    backdropFilter: 'blur(10px)',
                  },
                },
              }}
            />
          </div>
          </PWADetector>
        </Router>
      </ThemeProvider>
    </I18nextProvider>
  );
}
export default App;
