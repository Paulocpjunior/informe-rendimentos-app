import React from 'react';
import { AuthProvider, useAuth } from './config/AuthContext';
import Login from './components/Login';
import InformeApp from './components/InformeApp';

function AppContent() {
  const { user } = useAuth();
  return user ? <InformeApp /> : <Login />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
