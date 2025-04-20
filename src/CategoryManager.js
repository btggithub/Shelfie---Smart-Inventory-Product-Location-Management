// src\CategoryManager.js
import { useOutletContext } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, updateDoc, query, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Plus, Edit2, Save, X } from 'lucide-react';

const CategoryManager = () => {
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    isActive: true
  });
  const { user } = useOutletContext();
  const [editingCategory, setEditingCategory] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load categories
  useEffect(() => {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const categoriesData = [];
      snapshot.forEach((doc) => {
        categoriesData.push({ id: doc.id, ...doc.data() });
      });
      setCategories(categoriesData.sort((a, b) => a.name.localeCompare(b.name)));
    });

    return () => unsubscribe();
  }, []);

  const handleAddCategory = async () => {
    try {
      if (!newCategory.name.trim()) {
        setError('Category name is required');
        return;
      }

      // Check if category name already exists
      const existingCat = categories.find(
        cat => cat.name.toLowerCase() === newCategory.name.toLowerCase()
      );
      if (existingCat) {
        setError('Category name already exists');
        return;
      }

      await addDoc(collection(db, 'categories'), {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        isActive: true,
        createdBy: user.email,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      setNewCategory({
        name: '',
        description: '',
        isActive: true
      });
      setSuccess('Category added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error adding category: ' + error.message);
    }
  };

  const handleUpdateCategory = async (categoryId) => {
    try {
      // Check if name exists among other categories
      const existingCat = categories.find(
        cat => cat.id !== categoryId && 
        cat.name.toLowerCase() === editingCategory.name.toLowerCase()
      );
      if (existingCat) {
        setError('Category name already exists');
        return;
      }

      const categoryRef = doc(db, 'categories', categoryId);
      await updateDoc(categoryRef, {
        ...editingCategory,
        updatedAt: new Date(),
        updatedBy: user.email
      });

      setEditingCategory(null);
      setSuccess('Category updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating category: ' + error.message);
    }
  };

  const toggleCategoryStatus = async (category) => {
    try {
      const categoryRef = doc(db, 'categories', category.id);
      await updateDoc(categoryRef, {
        isActive: !category.isActive,
        updatedAt: new Date(),
        updatedBy: user.email
      });
      setSuccess(`Category ${category.isActive ? 'disabled' : 'enabled'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating category status: ' + error.message);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="bg-green-50 border-green-200">
              <AlertDescription>{success}</AlertDescription>
            </Alert>
          )}

          {/* Add new category form */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="New Category Name"
              value={newCategory.name}
              onChange={(e) => setNewCategory({
                ...newCategory,
                name: e.target.value
              })}
              className="flex-1 p-2 border rounded"
            />
            <input
              type="text"
              placeholder="Description (optional)"
              value={newCategory.description}
              onChange={(e) => setNewCategory({
                ...newCategory,
                description: e.target.value
              })}
              className="flex-1 p-2 border rounded"
            />
            <button
              onClick={handleAddCategory}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus size={20} />
              Add Category
            </button>
          </div>

          {/* Categories list */}
          <div className="border rounded">
            {categories.map(category => (
              <div 
                key={category.id}
                className={`p-3 border-b last:border-b-0 ${
                  !category.isActive ? 'opacity-50' : ''
                }`}
              >
                {editingCategory?.id === category.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingCategory.name}
                      onChange={(e) => setEditingCategory({
                        ...editingCategory,
                        name: e.target.value
                      })}
                      className="flex-1 p-2 border rounded"
                    />
                    <input
                      type="text"
                      value={editingCategory.description}
                      onChange={(e) => setEditingCategory({
                        ...editingCategory,
                        description: e.target.value
                      })}
                      placeholder="Description"
                      className="flex-1 p-2 border rounded"
                    />
                    <button
                      onClick={() => handleUpdateCategory(category.id)}
                      className="p-2 text-green-600 hover:bg-green-50 rounded"
                    >
                      <Save size={20} />
                    </button>
                    <button
                      onClick={() => setEditingCategory(null)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="flex-1 font-medium">{category.name}</span>
                    {category.description && (
                      <span className="text-gray-500">{category.description}</span>
                    )}
                    <button
                      onClick={() => setEditingCategory(category)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                    >
                      <Edit2 size={20} />
                    </button>
                    <button
                      onClick={() => toggleCategoryStatus(category)}
                      className={`px-3 py-1 rounded text-sm ${
                        category.isActive 
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100'
                      }`}
                    >
                      {category.isActive ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CategoryManager;