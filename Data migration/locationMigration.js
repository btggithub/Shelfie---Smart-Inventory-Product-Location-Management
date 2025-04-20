// locationMigration.js
import { initializeApp } from 'firebase/app';
import { 
  getFirestore,
  collection, 
  doc, 
  setDoc, 
  getDocs,
  writeBatch,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  getAuth, 
  signInWithEmailAndPassword 
} from 'firebase/auth';

// Firebase configuration
const firebaseConfig = {  
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// Authentication function
const authenticateAdmin = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      console.log('✅ Authentication successful');
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      throw error;
    }
  };

// Current location data structure
const currentLocations = {
  shelves: {
    leftWall: { 
      racks: ['Rack 1', 'Rack 2', 'Top'],
      name: 'Left Wall Shelf'
    },
    backWall: { 
      racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Top'],
      name: 'Back Wall Shelf'
    },
    rightWall: { 
      racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Rack 4', 'Top'],
      name: 'Right Wall Shelf'
    },
    smallshelf1: {
      racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Top'],
      name: 'Small Shelf 1'
    },
    smallshelf2: {
      racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Top'],
      name: 'Small Shelf 2'
    },
    smallshelf3: {
      racks: ['Rack 1', 'Rack 2', 'Rack 3', 'Top'],
      name: 'Small Shelf 3'
    }
  },
  showcase: {
    top: ['Top Left', 'Top Right'],
    leftColumn: { rows: ['Upper', 'Middle', 'Lower'] },
    rightColumn: { rows: ['Upper', 'Middle', 'Lower'] }
  },
  table: ['top'],
  strings: ['String 1', 'String 2', 'String 3', 'String 4']
};

// Migration functions
const migrateLocationTypes = async () => {
  try {
    const typesDoc = doc(db, 'locations', 'types');
    await setDoc(typesDoc, {
      available: ['shelf', 'showcase', 'table', 'string'],
      schemas: {
        shelf: { 
          requiresRacks: true,
          displayName: 'Shelf'
        },
        showcase: { 
          hasCustomPositions: true,
          displayName: 'Showcase'
        },
        string: { 
          simpleList: true,
          displayName: 'String'
        },
        table: { 
          singlePosition: true,
          displayName: 'Table'
        }
      },
      lastUpdated: serverTimestamp(),
      version: 1
    });
    console.log('✅ Location types migrated successfully');
  } catch (error) {
    console.error('❌ Error migrating location types:', error);
    throw error;
  }
};

const migrateShelves = async () => {
    const batch = writeBatch(db);
    let order = 1;
  
    try {
      for (const [key, shelf] of Object.entries(currentLocations.shelves)) {
        // Fixed: Using proper path construction
        const shelfRef = doc(db, 'locations', 'shelf', 'items', key);
        batch.set(shelfRef, {
          name: shelf.name,
          type: 'shelf',
          active: true,
          order: order++,
          racks: shelf.racks,
          lastUpdated: serverTimestamp(),
          identifier: key
        });
      }
  
      await batch.commit();
      console.log('✅ Shelves migrated successfully');
    } catch (error) {
      console.error('❌ Error migrating shelves:', error);
      throw error;
    }
  };
  
  const migrateShowcase = async () => {
    try {
      // Fixed: Using proper path construction
      const showcaseRef = doc(db, 'locations', 'showcase', 'items', 'main');
      await setDoc(showcaseRef, {
        name: 'Main Showcase',
        type: 'showcase',
        active: true,
        order: 1,
        positions: {
          top: currentLocations.showcase.top,
          leftColumn: currentLocations.showcase.leftColumn.rows,
          rightColumn: currentLocations.showcase.rightColumn.rows
        },
        lastUpdated: serverTimestamp(),
        identifier: 'main'
      });
      console.log('✅ Showcase migrated successfully');
    } catch (error) {
      console.error('❌ Error migrating showcase:', error);
      throw error;
    }
  };
  
  const migrateTable = async () => {
    try {
      // Fixed: Using proper path construction
      const tableRef = doc(db, 'locations', 'table', 'items', 'main');
      await setDoc(tableRef, {
        name: 'Main Table',
        type: 'table',
        active: true,
        order: 1,
        positions: currentLocations.table,
        lastUpdated: serverTimestamp(),
        identifier: 'main'
      });
      console.log('✅ Table migrated successfully');
    } catch (error) {
      console.error('❌ Error migrating table:', error);
      throw error;
    }
  };
  
  const migrateStrings = async () => {
    const batch = writeBatch(db);
    
    try {
      currentLocations.strings.forEach((string, index) => {
        // Fixed: Using proper path construction
        const stringRef = doc(db, 'locations', 'string', 'items', `string${index + 1}`);
        batch.set(stringRef, {
          name: string,
          type: 'string',
          active: true,
          order: index + 1,
          lastUpdated: serverTimestamp(),
          identifier: `string${index + 1}`
        });
      });
  
      await batch.commit();
      console.log('✅ Strings migrated successfully');
    } catch (error) {
      console.error('❌ Error migrating strings:', error);
      throw error;
    }
  };

// Main migration function
export const migrateLocations = async (email, password) => {
  try {
    console.log('🚀 Starting location data migration...');
    
    // Authenticate first
    await authenticateAdmin(email, password);
    
    // Run migrations in sequence
    await migrateLocationTypes();
    await migrateShelves();
    await migrateShowcase();
    await migrateTable();
    await migrateStrings();
    
    console.log('✨ All locations migrated successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Verification function
export const verifyMigration = async () => {
    try {
      console.log('🔍 Verifying migration...');
      
      const types = ['shelf', 'showcase', 'table', 'string'];
      let allData = {};
  
      for (const type of types) {
        // Fixed: Using proper path for verification
        const querySnapshot = await getDocs(collection(db, 'locations', type, 'items'));
        allData[type] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }
  
      console.log('📊 Migration Results:', allData);
      return allData;
    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  };