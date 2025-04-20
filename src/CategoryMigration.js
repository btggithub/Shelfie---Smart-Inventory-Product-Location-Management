// src\CategoryMigration.js
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const migrateCategories = async (user) => {
  try {
    // Initial categories    
    const initialCategories = [
      { id: 'toys', name: 'Toys', description: 'Children\'s toys and games' },
      { id: 'games', name: 'Games', description: 'Board games and entertainment' },
      { id: 'earrings', name: 'Earrings', description: 'Jewelry - Earrings' },
      { id: 'bangles', name: 'Bangles', description: 'Jewelry - Bangles' },
      { id: 'stationery', name: 'Stationery', description: 'Writing and office supplies' },
      { id: 'confectionery', name: 'Confectionery', description: 'Sweets and snacks' }
    ];

    // Check if categories already exist
    const categoriesRef = collection(db, 'categories');
    const existingCategoriesSnapshot = await getDocs(categoriesRef);
    
    if (existingCategoriesSnapshot.empty) {
      // Add categories if none exist
      for (const category of initialCategories) {
        await addDoc(categoriesRef, {
          name: category.name,
          description: category.description,
          isActive: true,
          parentId: null,
          createdBy: user.email,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
      console.log('Categories migrated successfully');
      return true;
    } else {
      console.log('Categories already exist, skipping migration');
      return false;
    }
  } catch (error) {
    console.error('Error migrating categories:', error);
    throw error;
  }
};