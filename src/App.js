// src\App.js - Updated with routing
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ShopInventoryAuth from './ShopInventoryAuth';
import ShopInventoryMain from './ShopInventoryMain';
import LocationManager from './LocationManager';
import CategoryManager from './CategoryManager';
import AddProductPage from './AddProductPage';
import ProtectedRoute from './ProtectedRoute';

function App() {
  return (
    <Router>
      <div className="App min-h-screen bg-gray-50">
        <Routes>
          <Route path="/login" element={<ShopInventoryAuth />} />
          <Route path="/" element={<ShopInventoryAuth />}>
            <Route index element={<ShopInventoryMain />} />
            <Route path="add-product" element={<AddProductPage />} />
            <Route path="locations" element={<LocationManager />} />
            <Route path="categories" element={<CategoryManager />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;