// src\historyUtils.js
import { collection, addDoc, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';

export const addToHistory = async (productId, previousLocation, newLocation, movedBy) => {
  try {
    await addDoc(collection(db, 'productHistory'), {
      productId,
      previousLocation,
      newLocation,
      movedBy,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error adding to history:', error);
  }
};

export const addBulkToHistory = async (products, newLocation, movedBy) => {
  try {
    const batch = writeBatch(db);
    const historyRef = collection(db, 'productHistory');
    
    products.forEach(product => {
      const newHistoryRef = doc(historyRef);
      batch.set(newHistoryRef, {
        productId: product.id,
        previousLocation: product.location,
        newLocation,
        movedBy,
        timestamp: new Date()
      });
    });

    await batch.commit();
  } catch (error) {
    console.error('Error adding bulk history:', error);
  }
};