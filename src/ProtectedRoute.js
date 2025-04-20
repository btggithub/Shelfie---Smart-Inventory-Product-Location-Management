// src\ProtectedRoute.js
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';

// A wrapper for the protected routes that handles authentication state
const ProtectedRoute = ({ isAuthenticated, children }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children || <Outlet />;
};

export default ProtectedRoute;