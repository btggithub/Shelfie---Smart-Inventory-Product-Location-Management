// src\ShopInventoryMain.js - removed add - Updated version
// to get user from context
import { useOutletContext } from 'react-router-dom';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MoveProductDialog from './MoveProductDialog';
import { Search, Move, Trash2, Clock, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { db } from './firebase';
import { 
  collection, 
  deleteDoc,
  doc, 
  onSnapshot,
  updateDoc,
  writeBatch,
  getDoc,
  query, 
  where
} from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';

// Location History Tracking
import { addToHistory, addBulkToHistory } from './historyUtils';
import ProductHistory from './ProductHistory';
import { migrateCategories } from './CategoryMigration';

const ShopInventoryMain = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [locationTypes, setLocationTypes] = useState(null);
  const [locationItems, setLocationItems] = useState({
    shelf: {},
    showcase: {},
    table: {},
    string: {}
  });
  const { user } = useOutletContext();
  // Function to transform Firestore data into the format our UI expects
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

  // Products state
  const [products, setProducts] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Move products
  const [isMoving, setIsMoving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const locations = useMemo(() => transformLocationsForUI(), [transformLocationsForUI]);

  const [selectedProducts, setSelectedProducts] = useState(new Set());
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // State for history viewing
  const [viewingHistoryFor, setViewingHistoryFor] = useState(null);

  // Effect for loading categories  
  useEffect(() => {
    if (!user) return;

    try {
      // Attempt migration first
      migrateCategories(user).catch(error => {
        console.error('Migration error:', error);
      });

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
    }
  }, [user]);

  // Products listener effect
  useEffect(() => {
    if (!user) return;
    
    try {
      const productsCollection = collection(db, 'products');
      const unsubscribe = onSnapshot(productsCollection, (snapshot) => {
        const productsData = [];
        snapshot.forEach((doc) => {
          productsData.push({ id: doc.id, ...doc.data() });
        });
        setProducts(productsData);
      }, (error) => {
        console.error("Firestore subscription error:", error);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error("Error setting up Firestore listener:", error);
    }
  }, [user]);

  // Locations listener effect
  useEffect(() => {
    if (!user) return;

    try {
      // Fetch location types configuration
      const typesUnsubscribe = onSnapshot(
        doc(db, 'locations', 'types'),
        (doc) => {
          if (doc.exists()) {
            setLocationTypes(doc.data());
          }
        },
        (error) => console.error("Error fetching location types:", error)
      );

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
        typesUnsubscribe();
        typeUnsubscribes.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error("Error setting up location listeners:", error);
    }
  }, [user]);

  // Move multiple products
  const moveMultipleProducts = async (productIds, newLocation) => {
    setIsLoading(true);
    const batch = writeBatch(db);
    
    try {
      // Get all products first to record their previous locations
      const productsToMove = [];
      for (const productId of productIds) {
        const productDoc = await getDoc(doc(db, 'products', productId));
        productsToMove.push({
          id: productId,
          location: productDoc.data().location
        });
      }

      // Update all products
      productIds.forEach(productId => {
        const productRef = doc(db, 'products', productId);
        batch.update(productRef, {
          location: newLocation,
          lastUpdated: new Date(),
          updatedBy: user.email
        });
      });

      await batch.commit();

      // Add history records
      await addBulkToHistory(productsToMove, newLocation, user.email);

      setSuccessMessage('Products moved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Batch move failed:', error);
      setValidationError('Failed to move products: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsBulkMoving(false);
    }
  };

  // Delete multiple products
  const deleteMultipleProducts = async () => {
    setIsLoading(true);
    const batch = writeBatch(db);
    
    try {
      Array.from(selectedProducts).forEach(productId => {
        const productRef = doc(db, 'products', productId);
        batch.delete(productRef);
      });

      await batch.commit();
      setSuccessMessage('Products deleted successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
      setSelectedProducts(new Set());
    } catch (error) {
      console.error('Batch delete failed:', error);
      setValidationError('Failed to delete products: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsBulkDeleting(false);
    }
  };

  const handleProductSelect = (productId) => {
    const newSelected = new Set(selectedProducts);
    if (newSelected.has(productId)) {
      newSelected.delete(productId);
    } else {
      newSelected.add(productId);
    }
    setSelectedProducts(newSelected);
  };

  const handleBulkMove = () => {
    if (selectedProducts.size > 0) {
      setIsBulkMoving(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedProducts.size > 0) {
      setIsBulkDeleting(true);
    }
  };

  // Remove product
  const removeProduct = async (productId) => {
    try {
      await deleteDoc(doc(db, 'products', productId));
      setSuccessMessage('Product removed successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error removing product:', error);
      setValidationError('Error removing product: ' + error.message);
    }
  };

  // Filter products by search term and category
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    
    return matchesSearch && matchesCategory;
  });

  // Get products by location
  const getProductsByLocation = (locationType, position, subPosition) => {
    if (locationType === 'showcase') {
      const [showcaseId, section] = position.split('-');
      return products.filter(product =>
        product.location.type === locationType &&
        product.location.showcase === showcaseId &&
        product.location.position === section
      );
    } else if (locationType === 'table') {
      const [tableId] = position.split('-');
      return products.filter(product =>
        product.location.type === locationType &&
        product.location.table === tableId &&
        product.location.position === 'top'
      );
    }
    
    return products.filter(product =>
      product.location.type === locationType &&
      product.location.position === position &&
      (!subPosition || product.location.subPosition === subPosition)
    );
  };

  // Move product  
  const moveProduct = async (productId, newLocation) => {
    try {
      setIsLoading(true);
      const productRef = doc(db, 'products', productId);
      
      // Get the current product data before updating
      const productDoc = await getDoc(productRef);
      const previousLocation = productDoc.data().location;
  
      // Update the product location
      await updateDoc(productRef, { 
        location: newLocation,
        lastUpdated: new Date(),
        updatedBy: user.email
      });
  
      // Add to history
      await addToHistory(
        productId,
        previousLocation,
        newLocation,
        user.email
      );
  
      setSuccessMessage('Product moved successfully!');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error moving product:', error);
      setValidationError('Failed to move product: ' + error.message);
    } finally {
      setIsLoading(false);
      setIsMoving(false);
      setSelectedProduct(null);
    }
  };

  const renderBulkDeleteDialog = () => {
    if (!isBulkDeleting) return null;
  
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-semibold mb-4">Delete Multiple Products</h2>
          <p className="text-gray-600 mb-4">
            Are you sure you want to delete {selectedProducts.size} products? This action cannot be undone.
          </p>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsBulkDeleting(false)}
              className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={deleteMultipleProducts}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Delete Products
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto">
      {/* Prominent search section */}
      <div className="mb-6">
        <Card className="border-blue-100 shadow-md">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-center">
              <div className="relative flex-1 w-full">
                <input
                  type="text"
                  placeholder="Search products by name or category..."
                  className="w-full p-3 pl-10 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute left-3 top-3.5 text-blue-400" size={20} />
              </div>
              
              <select
                className="w-full md:w-auto p-3 border-2 border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category.id} value={category.name}>{category.name}</option>
                ))}
              </select>
              
              <button
                onClick={() => navigate('/add-product')}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <PlusCircle size={20} />
                Add New Product
              </button>
            </div>
            
            {/* Quick filter buttons for popular categories */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setSelectedCategory('')}
                  className={`px-3 py-1 text-sm rounded-full ${
                    !selectedCategory 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  All
                </button>
                {categories.slice(0, 5).map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.name)}
                    className={`px-3 py-1 text-sm rounded-full ${
                      selectedCategory === category.name 
                        ? 'bg-blue-500 text-white' 
                        : 'bg-gray-100 hover:bg-gray-200'
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Success and error messages */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200 mb-4">
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      )}
      {validationError && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{validationError}</AlertDescription>
        </Alert>
      )}

      {/* Results section */}
      <div className="mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Search Results</CardTitle>
            <div className="text-sm text-gray-500">
              {filteredProducts.length} {filteredProducts.length === 1 ? 'product' : 'products'} found
            </div>
          </CardHeader>
          <CardContent>
            {selectedProducts.size > 0 && (
              <div className="mb-4 p-2 bg-blue-50 rounded flex justify-between items-center">
                <span>{selectedProducts.size} products selected</span>
                <div className="space-x-2">
                  <button
                    onClick={handleBulkMove}
                    className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Move Selected
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Delete Selected
                  </button>                      
                </div>
              </div>
            )}
            
            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No products found matching your search criteria
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {filteredProducts.map(product => (
                  <div key={product.id} className="p-3 border rounded-lg mb-2 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedProducts.has(product.id)}
                          onChange={() => handleProductSelect(product.id)}
                          className="h-4 w-4 text-blue-600"
                        />
                        <div>
                          <h3 className="font-semibold">{product.name}</h3>
                          <p className="text-sm text-gray-600">{product.category}</p>
                          <p className="text-sm text-gray-500">
                            Location: {
                              product.location.type === 'showcase' ? (
                                `showcase - ${locations.showcases[product.location.showcase]?.name || product.location.position} - ${product.location.position} - ${product.location.subPosition}`
                              ) : product.location.type === 'table' ? (
                                `table - ${locations.tables[product.location.table]?.name || 'Unknown'} - ${product.location.position}`
                              ) : product.location.type === 'shelf' ? (
                                `${product.location.type} - ${locations.shelves[product.location.position]?.name || product.location.position}${product.location.subPosition ? ` - ${product.location.subPosition}` : ''}`
                              ) : (
                                `${product.location.type} - ${product.location.position}${product.location.subPosition ? ` - ${product.location.subPosition}` : ''}`
                              )
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="text-gray-500 hover:text-gray-700 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                          onClick={() => setViewingHistoryFor(product.id)}
                          title="View History"
                        >
                          <Clock size={20} />
                        </button>
                        <button
                          className="text-blue-500 hover:text-blue-700 p-1.5 rounded-full hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsMoving(true);
                          }}
                          title="Move Product"
                        >
                          <Move size={20} />
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-50 transition-colors"
                          onClick={() => removeProduct(product.id)}
                          title="Remove Product"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location View */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Location View</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <select
              className="w-full p-2 border rounded"
              onChange={(e) => setSelectedLocation(e.target.value)}
              value={selectedLocation || ''}
            >
              <option value="">Select Location to View</option>
              <optgroup label="Shelves">
                {Object.entries(locations.shelves).map(([key, shelf]) => (
                  <option key={`shelf-${key}`} value={`shelf-${key}`}>
                    {shelf.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Showcases">
                {Object.entries(locations.showcases || {}).map(([showcaseId, showcase]) => (
                  <React.Fragment key={showcaseId}>
                    <option value={`showcase-${showcaseId}-top`}>
                      {showcase.name} - Top Section
                    </option>
                    <option value={`showcase-${showcaseId}-leftColumn`}>
                      {showcase.name} - Left Column
                    </option>
                    <option value={`showcase-${showcaseId}-rightColumn`}>
                      {showcase.name} - Right Column
                    </option>
                  </React.Fragment>
                ))}
              </optgroup>
              <optgroup label="Strings">
                {locations.strings.map(string => (
                  <option key={string} value={`string-${string}`}>{string}</option>
                ))}
              </optgroup>
              <optgroup label="Tables">
                {Object.entries(locations.tables || {}).map(([tableId, table]) => (
                  <option key={`table-${tableId}`} value={`table-${tableId}-top`}>
                    {table.name}
                  </option>
                ))}
              </optgroup>
            </select>
            
            {selectedLocation && (
              <div className="border rounded p-4">
                <h3 className="font-semibold mb-2">Products in selected location:</h3>
                <div className="space-y-2">
                  {(() => {
                    const [type, ...rest] = selectedLocation.split('-');
                    if (type === 'showcase') {
                      // For showcase, combine the remaining parts except the last one
                      const showcaseSection = rest.pop(); // Get the section (top/leftColumn/rightColumn)
                      const showcaseId = rest.join('-'); // Combine the rest for showcase ID
                      return getProductsByLocation(type, `${showcaseId}-${showcaseSection}`);
                    }
                    return getProductsByLocation(type, rest.join('-'));
                  })().map(product => (
                    <div key={product.id} className="p-2 border rounded hover:bg-gray-50 transition-colors flex justify-between items-center">
                      <div>
                        <span className="font-medium">{product.name}</span>
                        <span className="text-sm text-gray-600 ml-2">({product.category})</span>
                        <span className="text-sm text-gray-500 ml-2">
                          {product.location.subPosition && `- ${product.location.subPosition}`}
                        </span>
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-50 transition-colors"
                          onClick={() => setViewingHistoryFor(product.id)}
                          title="View History"
                        >
                          <Clock size={20} />
                        </button>
                        <button
                          className="text-blue-500 hover:text-blue-700 p-1 rounded-full hover:bg-blue-50 transition-colors"
                          onClick={() => {
                            setSelectedProduct(product);
                            setIsMoving(true);
                          }}
                          title="Move Product"
                        >
                          <Move size={20} />
                        </button>
                        <button
                          className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors"
                          onClick={() => removeProduct(product.id)}
                          title="Remove Product"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {(() => {
                    const [type, ...rest] = selectedLocation.split('-');
                    const products = type === 'showcase' ? 
                      (() => {
                        const showcaseSection = rest.pop();
                        const showcaseId = rest.join('-');
                        return getProductsByLocation(type, `${showcaseId}-${showcaseSection}`);
                      })() : 
                      getProductsByLocation(type, rest.join('-'));
                    
                    if (products.length === 0) {
                      return (
                        <div className="text-center py-4 text-gray-500">
                          No products in this location
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <MoveProductDialog 
        isOpen={isMoving || isBulkMoving}
        onClose={() => {
          setIsMoving(false);
          setIsBulkMoving(false);
          setSelectedProduct(null);
        }}
        onMove={isBulkMoving ? 
          (_, newLocation) => moveMultipleProducts(Array.from(selectedProducts), newLocation) :
          moveProduct
        }
        product={selectedProduct}
        locations={locations}
        isLoading={isLoading}
        isBulkMove={isBulkMoving}
        selectedCount={selectedProducts.size}
      />
      {renderBulkDeleteDialog()}
      <ProductHistory 
        productId={viewingHistoryFor}
        onClose={() => setViewingHistoryFor(null)}
      />
    </div>
  );
};

export default ShopInventoryMain;