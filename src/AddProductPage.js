// src\AddProductPage.js
import { useOutletContext } from 'react-router-dom';
import React, { useState, useEffect, useCallback } from 'react';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Plus, AlertCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import CsvProductUpload from './CsvProductUpload';
import CsvTemplateDownload from './CsvTemplateDownload';
import { useNavigate } from 'react-router-dom';

const AddProductPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('single');
  const { user } = useOutletContext();
  const [categories, setCategories] = useState([]);
  const [locationItems, setLocationItems] = useState({
    shelf: {},
    showcase: {},
    table: {},
    string: {}
  });
  const [newProduct, setNewProduct] = useState({
    name: '',
    category: '',
    location: {
      type: '',
      showcase: '',
      table: '',
      position: '',
      subPosition: ''
    }
  });
  const [validationError, setValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load categories
  useEffect(() => {
    if (!user) return;
    
    try {
      // Set up categories listener
      const categoriesRef = collection(db, 'categories');
      const q = query(categoriesRef, where('isActive', '==', true));

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const categoriesData = [];
        snapshot.forEach((doc) => {
          categoriesData.push({ 
            id: doc.id,
            ...doc.data()
          });
        });
        setCategories(categoriesData.sort((a, b) => a.name.localeCompare(b.name)));
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error setting up category listener:', error);
      setValidationError('Error loading categories: ' + error.message);
    }
  }, [user]);

  // Load locations
  useEffect(() => {
    if (!user) return;

    try {
      // Fetch items for each location type
      const typeUnsubscribes = ['shelf', 'showcase', 'table', 'string'].map(type => {
        return onSnapshot(
          collection(db, 'locations', type, 'items'),
          (snapshot) => {
            const items = {};
            snapshot.forEach(doc => {
              items[doc.id] = doc.data();
            });
            setLocationItems(prev => ({
              ...prev,
              [type]: items
            }));
          },
          (error) => console.error(`Error fetching ${type} locations:`, error)
        );
      });

      // Cleanup subscriptions
      return () => {
        typeUnsubscribes.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error("Error setting up location listeners:", error);
      setValidationError('Error loading locations: ' + error.message);
    }
  }, [user]);

  // Transform locationItems into the format expected by the UI
  const transformLocationsForUI = useCallback(() => {
    const transformed = {
      shelves: Object.entries(locationItems.shelf || {}).reduce((acc, [key, item]) => {
        if (item && item.active) {
          acc[item.identifier] = {
            racks: item.racks || [],
            name: item.name
          };
        }
        return acc;
      }, {}),
      
      showcases: Object.entries(locationItems.showcase || {}).reduce((acc, [key, item]) => {
        if (item && item.active) {
          acc[item.identifier] = {
            top: item.positions?.top || [],
            leftColumn: {
              rows: item.positions?.leftColumn || []
            },
            rightColumn: {
              rows: item.positions?.rightColumn || []
            },
            name: item.name,
            identifier: item.identifier
          };
        }
        return acc;
      }, {}),
      
      tables: Object.entries(locationItems.table || {}).reduce((acc, [key, item]) => {
        if (item && item.active) {
          acc[item.identifier] = {
            positions: item.positions || ['top'],
            name: item.name,
            identifier: item.identifier
          };
        }
        return acc;
      }, {}),
      
      strings: Object.values(locationItems.string || {})
        .filter(item => item.active)
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => item.name)
    };
    
    return transformed;
  }, [locationItems]);
  
  // Get transformed locations
  const locations = transformLocationsForUI();

  // Add new product
  const addProduct = async () => {
    // Reset validation error
    setValidationError('');

    // Validate required fields
    if (!newProduct.name.trim()) {
      setValidationError('Product name is required');
      return;
    }
    if (!newProduct.category) {
      setValidationError('Please select a category');
      return;
    }
    if (!newProduct.location.type) {
      setValidationError('Please select a location type');
      return;
    }
    if (!newProduct.location.position && newProduct.location.type !== 'table') {
      setValidationError('Please select a specific location');
      return;
    }
    if (!['table', 'string'].includes(newProduct.location.type) && !newProduct.location.subPosition) {
      setValidationError('Please select a sub-position (rack/shelf position)');
      return;
    }
    
    setIsLoading(true);
    try {
      if (newProduct.location.type === 'table') {
        await addDoc(collection(db, 'products'), {
          ...newProduct,
          location: {
            type: 'table',
            table: newProduct.location.table,
            position: 'top'
          },
          createdAt: new Date(),
          userId: user.uid,
          createdBy: user.email,
          updatedBy: user.email
        });
      } else {
        if (newProduct.location.type === 'showcase') {
          await addDoc(collection(db, 'products'), {
            ...newProduct,
            location: {
              type: 'showcase',
              showcase: newProduct.location.showcase,
              position: newProduct.location.position,
              subPosition: newProduct.location.subPosition
            },
            createdAt: new Date(),
            userId: user.uid,
            createdBy: user.email,
            updatedBy: user.email
          });
        } else {
          await addDoc(collection(db, 'products'), {
            ...newProduct,
            createdAt: new Date(),
            userId: user.uid,
            createdBy: user.email,
            updatedBy: user.email
          });
        }
      }
      setNewProduct({
        name: '',
        category: '',
        location: { type: '', showcase: '', table: '', position: '', subPosition: '' }
      });
      setSuccessMessage('Product added successfully!');
      setTimeout(() => {
        setSuccessMessage('');
        // Optionally navigate back to main page after successful add
        // navigate('/');
      }, 3000);
    } catch (error) {
      setValidationError('Error adding product: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Render location selector based on type
  const renderLocationSelector = () => {
    if (!locations) {
      return null;
    }
  
    switch(newProduct.location.type) {
      case 'shelf':
        const availableShelves = Object.entries(locations.shelves || {});
        return (
          <div className="space-y-2">
            <select
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newProduct.location.position}
              onChange={(e) => setNewProduct({
                ...newProduct,
                location: {
                  ...newProduct.location, 
                  position: e.target.value, 
                  subPosition: ''
                }
              })}
            >
              <option value="">Select Shelf</option>
              {availableShelves.map(([key, shelf]) => (
                <option key={key} value={key}>
                  {shelf.name || key}
                </option>
              ))}
            </select>
  
            {newProduct.location.position && locations.shelves[newProduct.location.position]?.racks && (
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.location.subPosition}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  location: {
                    ...newProduct.location, 
                    subPosition: e.target.value
                  }
                })}
              >
                <option value="">Select Rack</option>
                {locations.shelves[newProduct.location.position].racks.map(rack => (
                  <option key={rack} value={rack}>{rack}</option>
                ))}
              </select>
            )}
          </div>
        );
  
      case 'showcase':
        const availableShowcases = Object.entries(locations.showcases || {});
        return (
          <div className="space-y-2">
            <select
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newProduct.location.showcase}
              onChange={(e) => setNewProduct({
                ...newProduct,
                location: {
                  ...newProduct.location,
                  showcase: e.target.value,
                  position: '',
                  subPosition: ''
                }
              })}
            >
              <option value="">Select Showcase</option>
              {availableShowcases.map(([id, showcase]) => (
                <option key={id} value={id}>
                  {showcase.name || id}
                </option>
              ))}
            </select>
      
            {newProduct.location.showcase && (
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.location.position}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  location: {
                    ...newProduct.location,
                    position: e.target.value,
                    subPosition: ''
                  }
                })}
              >
                <option value="">Select Section</option>
                {locations.showcases[newProduct.location.showcase]?.top?.length > 0 && (
                  <option value="top">
                    Top Section ({locations.showcases[newProduct.location.showcase].top.length} positions)
                  </option>
                )}
                {locations.showcases[newProduct.location.showcase]?.leftColumn?.rows?.length > 0 && (
                  <option value="leftColumn">
                    Left Column ({locations.showcases[newProduct.location.showcase].leftColumn.rows.length} positions)
                  </option>
                )}
                {locations.showcases[newProduct.location.showcase]?.rightColumn?.rows?.length > 0 && (
                  <option value="rightColumn">
                    Right Column ({locations.showcases[newProduct.location.showcase].rightColumn.rows.length} positions)
                  </option>
                )}
              </select>
            )}
      
            {newProduct.location.showcase && newProduct.location.position && (
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.location.subPosition}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  location: {
                    ...newProduct.location,
                    subPosition: e.target.value
                  }
                })}
              >
                <option value="">Select Position</option>
                {newProduct.location.position === 'top' 
                  ? locations.showcases[newProduct.location.showcase].top.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))
                  : locations.showcases[newProduct.location.showcase][newProduct.location.position].rows.map(row => (
                      <option key={row} value={row}>{row}</option>
                    ))
                }
              </select>
            )}
          </div>
        );
  
      case 'table':
        const availableTables = Object.entries(locations.tables || {});
        return (
          <div className="space-y-2">
            <select
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={newProduct.location.table}
              onChange={(e) => setNewProduct({
                ...newProduct,
                location: {
                  ...newProduct.location,
                  table: e.target.value,
                  position: 'top',
                  subPosition: ''
                }
              })}
            >
              <option value="">Select Table</option>
              {availableTables.map(([id, table]) => (
                <option key={id} value={id}>
                  {table.name}
                </option>
              ))}
            </select>
          </div>
        );
  
      case 'string':
        return (
          <select
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={newProduct.location.position}
            onChange={(e) => setNewProduct({
              ...newProduct,
              location: {
                ...newProduct.location, 
                position: e.target.value,
                subPosition: ''
              }
            })}
          >
            <option value="">Select String</option>
            {locations.strings.map((stringName, index) => (
              <option key={index} value={stringName}>
                {stringName}
              </option>
            ))}
          </select>
        );
  
      default:
        return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Add Products</CardTitle>
            <CsvTemplateDownload />
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="single" onValueChange={setActiveTab}>Single Product</TabsTrigger>
              <TabsTrigger value="bulk" onValueChange={setActiveTab}>Bulk Upload</TabsTrigger>
            </TabsList>
            
            <TabsContent value="single" activeValue={activeTab} className="space-y-4">
              {successMessage && (
                <Alert className="bg-green-50 border-green-200">
                  <AlertDescription>{successMessage}</AlertDescription>
                </Alert>
              )}
              {validationError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}
              <input
                type="text"
                placeholder="Product Name"
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.name}
                onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                disabled={isLoading}
              />
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.category}
                onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                disabled={isLoading}
              >
                <option value="">Select Category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
              <select
                className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={newProduct.location.type}
                onChange={(e) => setNewProduct({
                  ...newProduct,
                  location: {type: e.target.value, position: '', showcase: '', table: '', subPosition: ''}
                })}
                disabled={isLoading}
              >
                <option value="">Select Location Type *</option>
                <option value="shelf">Shelf</option>
                <option value="showcase">Showcase</option>
                <option value="string">String</option>
                <option value="table">Table</option>
              </select>
              
              {renderLocationSelector()}

              <button
                className={`w-full p-2 bg-blue-500 text-white rounded flex items-center justify-center gap-2 ${
                  isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'
                }`}
                onClick={addProduct}
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Adding...
                  </div>
                ) : (
                  <>
                    <Plus size={20} /> Add Product
                  </>
                )}
              </button>
            </TabsContent>
            
            <TabsContent value="bulk" activeValue={activeTab}>
              <CsvProductUpload 
                user={user} 
                categories={categories} 
                locations={locations}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddProductPage;