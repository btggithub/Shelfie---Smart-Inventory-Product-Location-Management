# Shop Inventory Management System

A React-based inventory management system with Firebase integration for tracking products across multiple locations.

## Technology Stack
- Frontend: React, Tailwind CSS
- Backend: Firebase (Firestore, Authentication)
- Build: Create React App
- Testing: Jest

## Key Features
- Location-based product tracking
- Product movement history
- Category management
- User authentication

## Project Structure

```
shop-inventory/
├── public/                  # Static assets
├── src/
│   ├── components/          # Reusable UI components
│   ├── lib/                 # Utility functions
│   ├── App.js               # Main application component
│   ├── firebase.js          # Firebase configuration
│   ├── ShopInventoryMain.js # Core inventory management
│   ├── LocationManager.js   # Location management
│   ├── CategoryManager.js   # Category management
│   └── ...                  # Other feature files
├── Data migration/          # Data migration scripts
└── baCKUP/                  # Backup files
```

## Key Components

### LocationManager.js
Manages physical locations where products are stored. Provides:
- Location CRUD operations
- Product movement tracking
- Location analytics

### ShopInventoryMain.js
Core inventory management component that:
- Displays current inventory
- Handles product movements
- Integrates with LocationManager

### Firebase Integration
- Authentication via `ShopInventoryAuth.js`
- Data storage via `firebase.js`
- Real-time updates using Firestore listeners

## Setup Instructions

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Firebase:
   - Create a `.env` file in the root directory.
   - Add the following environment variables with your Firebase project credentials:
     ```
     REACT_APP_FIREBASE_API_KEY=your_api_key
     REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
     REACT_APP_FIREBASE_PROJECT_ID=your_project_id
     REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
     REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
     REACT_APP_FIREBASE_APP_ID=your_app_id
     REACT_APP_FIREBASE_MEASUREMENT_ID=your_measurement_id
     ```

4. Start development server: `npm start`

## Data Flow

1. User authenticates via `ShopInventoryAuth`
2. Main inventory view loads from `ShopInventoryMain`
3. Location data fetched via `LocationManager`
4. Product movements recorded in Firestore
5. History tracked via `ProductHistory` component

## Extending the System

To add new features:
1. Create new component in `src/components/`
2. Connect to Firebase via `firebase.js`
3. Add routing in `App.js` if needed
4. For data migrations, use `Data migration/` scripts

## API Reference

### Firebase Collections
- `locations` - Stores physical locations
- `products` - Product inventory
- `movements` - Product movement history

### Key Functions
- `addLocation()` (LocationManager.js) - Adds new storage location
- `moveProduct()` (ShopInventoryMain.js) - Handles product transfers
- `getCategoryStats()` (CategoryManager.js) - Returns category analytics
