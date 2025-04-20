// src\CsvProductUpload.js
import React, { useState, useRef } from 'react';
import { collection, writeBatch, doc } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Upload, FileText, Check, AlertCircle } from 'lucide-react';
import Papa from 'papaparse';

const CsvProductUpload = ({ user, categories, locations }) => {
  const [file, setFile] = useState(null);
  const [parsedData, setParsedData] = useState([]);
  const [validationErrors, setValidationErrors] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  // Expected CSV columns: Product Name,Category,Location Type,Location Name,Section,Position
  const expectedHeaders = ['Product Name', 'Category', 'Location Type', 'Location Name', 'Section', 'Position'];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setValidationErrors([]);
      setParsedData([]);
      setUploadResult(null);
      parseCSV(selectedFile);
    }
  };

  const parseCSV = (file) => {
    setIsLoading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, errors: parseErrors, meta } = results;
        
        // Check for parsing errors
        if (parseErrors.length > 0) {
          setValidationErrors(parseErrors.map(error => `Row ${error.row}: ${error.message}`));
          setIsLoading(false);
          return;
        }
        
        // Validate headers
        const headers = meta.fields || [];
        const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
        
        if (missingHeaders.length > 0) {
          setValidationErrors([`Missing required columns: ${missingHeaders.join(', ')}`]);
          setIsLoading(false);
          return;
        }
        
        // Validate data and transform into product objects
        const { validProducts, errors: validationErrors } = validateProducts(data);
        
        setParsedData(validProducts);
        setValidationErrors(validationErrors);
        setIsLoading(false);
      },
      error: (error) => {
        setValidationErrors([`Error parsing file: ${error.message}`]);
        setIsLoading(false);
      }
    });
  };

  const validateProducts = (data) => {
    const validProducts = [];
    const errors = [];
    
    // Get existing category names
    const categoryNames = categories.map(cat => cat.name.toLowerCase());
    
    data.forEach((row, index) => {
      const rowNum = index + 2; // +2 because of 0-indexing and header row
      const product = {
        name: row['Product Name']?.trim(),
        category: row['Category']?.trim(),
        location: {
          type: row['Location Type']?.trim().toLowerCase(),
          position: '',
          subPosition: ''
        }
      };
      
      const locationErrors = [];
      
      // Validate product name
      if (!product.name) {
        locationErrors.push('Product name is required');
      }
      
      // Validate category
      if (!product.category) {
        locationErrors.push('Category is required');
      } else if (!categoryNames.includes(product.category.toLowerCase())) {
        locationErrors.push(`Category "${product.category}" does not exist`);
      }
      
      // Validate location type
      if (!product.location.type) {
        locationErrors.push('Location type is required');
      } else if (!['shelf', 'showcase', 'table', 'string'].includes(product.location.type)) {
        locationErrors.push(`Invalid location type: ${product.location.type}`);
      } else {
        const locationType = product.location.type;
        const locationName = row['Location Name']?.trim();
        const section = row['Section']?.trim();
        const position = row['Position']?.trim();
        
        // Validate location based on type
        switch (locationType) {
          case 'shelf':
            // Check if shelf exists
            if (!locationName || !locations.shelves[locationName]) {
              locationErrors.push(`Shelf "${locationName}" does not exist`);
            } else {
              product.location.position = locationName;
              
              // Validate rack (subPosition)
              if (!position) {
                locationErrors.push('Rack position is required for shelves');
              } else if (!locations.shelves[locationName].racks.includes(position)) {
                locationErrors.push(`Rack "${position}" does not exist in shelf "${locationName}"`);
              } else {
                product.location.subPosition = position;
              }
            }
            break;
            
          case 'showcase':
            // Check if showcase exists
            if (!locationName || !locations.showcases[locationName]) {
              locationErrors.push(`Showcase "${locationName}" does not exist`);
            } else {
              // Store showcase ID
              product.location.showcase = locationName;
              
              // Validate section
              if (!section || !['top', 'leftColumn', 'rightColumn'].includes(section)) {
                locationErrors.push('Valid section (top, leftColumn, rightColumn) is required for showcases');
              } else {
                product.location.position = section;
                
                // Validate position within section
                if (!position) {
                  locationErrors.push(`Position is required for showcase section "${section}"`);
                } else {
                  let validPosition = false;
                  if (section === 'top') {
                    validPosition = locations.showcases[locationName].top.includes(position);
                  } else if (section === 'leftColumn') {
                    validPosition = locations.showcases[locationName].leftColumn.rows.includes(position);
                  } else if (section === 'rightColumn') {
                    validPosition = locations.showcases[locationName].rightColumn.rows.includes(position);
                  }
                  
                  if (!validPosition) {
                    locationErrors.push(`Position "${position}" does not exist in showcase "${locationName}" section "${section}"`);
                  } else {
                    product.location.subPosition = position;
                  }
                }
              }
            }
            break;
            
          case 'table':
            // Check if table exists
            if (!locationName || !locations.tables[locationName]) {
              locationErrors.push(`Table "${locationName}" does not exist`);
            } else {
              // Store table ID and set position to 'top'
              product.location.table = locationName;
              product.location.position = 'top';
            }
            break;
            
          case 'string':
            // Check if string exists
            if (!locationName || !locations.strings.includes(locationName)) {
              locationErrors.push(`String "${locationName}" does not exist`);
            } else {
              product.location.position = locationName;
            }
            break;
        }
      }
      
      if (locationErrors.length > 0) {
        errors.push(`Row ${rowNum}: ${locationErrors.join(', ')}`);
      } else {
        validProducts.push(product);
      }
    });
    
    return { validProducts, errors };
  };

  const uploadProducts = async () => {
    if (parsedData.length === 0) return;
    
    setIsUploading(true);
    setUploadProgress(0);
    setUploadResult(null);
    
    try {
      // We may need multiple batches if we have a large number of products
      // Firestore has a limit of 500 operations per batch
      const MAX_BATCH_SIZE = 400; // Using 400 to be safe
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;
      const productsRef = collection(db, 'products');
      const historyRef = collection(db, 'productHistory');
      
      // Prepare references for all the new products
      const productRefs = parsedData.map(() => doc(productsRef));
      
      // Process products in batches
      parsedData.forEach((product, index) => {
        // Add product to batch
        const newProductRef = productRefs[index];
        const newProduct = {
          ...product,
          createdAt: new Date(),
          lastUpdated: new Date(),
          userId: user.uid,
          createdBy: user.email,
          updatedBy: user.email
        };
        
        currentBatch.set(newProductRef, newProduct);
        operationCount++;
        
        // Add history record for the new product
        const historyData = {
          productId: newProductRef.id,
          previousLocation: null, // New product has no previous location
          newLocation: product.location,
          movedBy: user.email,
          timestamp: new Date(),
          actionType: 'create'
        };
        
        const newHistoryRef = doc(historyRef);
        currentBatch.set(newHistoryRef, historyData);
        operationCount++;
        
        // If we've reached the batch limit, start a new batch
        if (operationCount >= MAX_BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
        
        // Update progress
        const progress = Math.round(((index + 1) / parsedData.length) * 100);
        setUploadProgress(progress);
      });
      
      // Add the last batch if it has operations
      if (operationCount > 0) {
        batches.push(currentBatch);
      }
      
      // Commit all batches sequentially
      for (let i = 0; i < batches.length; i++) {
        await batches[i].commit();
        
        // Update progress to show batch commits
        const batchProgress = Math.min(100, Math.round(((i + 1) / batches.length) * 100));
        setUploadProgress(batchProgress);
      }
      
      setUploadResult({
        success: true,
        message: `Successfully uploaded ${parsedData.length} products.`
      });
      
      // Reset state
      setFile(null);
      setParsedData([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error('Error uploading products:', error);
      setUploadResult({
        success: false,
        message: `Error uploading products: ${error.message}`
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === "text/csv") {
      setFile(droppedFile);
      parseCSV(droppedFile);
    } else {
      setValidationErrors(['Please drop a valid CSV file']);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bulk Upload Products</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* File upload area */}
          <div 
            className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
            />
            
            {!file ? (
              <div className="space-y-2">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <p className="text-lg">Drag and drop a CSV file here, or click to select</p>
                <p className="text-sm text-gray-500">
                  The CSV should contain columns: Product Name, Category, Location Type, Location Name, Section, Position
                </p>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Select CSV File
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <FileText className="mx-auto h-12 w-12 text-blue-500" />
                <p className="text-lg font-medium">{file.name}</p>
                <p className="text-sm text-gray-500">
                  {isLoading ? 'Parsing file...' : `${parsedData.length} valid products found`}
                </p>
                <button
                  onClick={() => fileInputRef.current.click()}
                  className="mt-2 px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
                >
                  Change File
                </button>
              </div>
            )}
          </div>
          
          {/* Validation errors */}
          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-medium">The following errors were found:</div>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Upload progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Uploading products...</div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-blue-600 h-2.5 rounded-full" 
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-500 text-right">{uploadProgress}%</div>
            </div>
          )}
          
          {/* Upload result */}
          {uploadResult && (
            <Alert className={uploadResult.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              {uploadResult.success ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600" />
              )}
              <AlertDescription className={uploadResult.success ? "text-green-700" : "text-red-700"}>
                {uploadResult.message}
              </AlertDescription>
            </Alert>
          )}
          
          {/* Upload button */}
          {parsedData.length > 0 && !isUploading && (
            <div className="flex justify-end">
              <button
                onClick={uploadProducts}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
                disabled={isUploading}
              >
                <Upload size={20} />
                Upload {parsedData.length} Products
              </button>
            </div>
          )}
          
          {/* CSV format example */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">CSV Format Example:</h3>
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  {expectedHeaders.map((header, i) => (
                    <th key={i} className="py-2 text-left">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2">Silver Bracelet</td>
                  <td className="py-2">Bangles</td>
                  <td className="py-2">shelf</td>
                  <td className="py-2">Back Wall Shelf 1</td>
                  <td className="py-2"></td>
                  <td className="py-2">Rack 1</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Gold Ring</td>
                  <td className="py-2">Earrings</td>
                  <td className="py-2">showcase</td>
                  <td className="py-2">Main Showcase</td>
                  <td className="py-2">top</td>
                  <td className="py-2">Top Left</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2">Crystal Necklace</td>
                  <td className="py-2">Bangles</td>
                  <td className="py-2">string</td>
                  <td className="py-2">String 1</td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                </tr>
                <tr>
                  <td className="py-2">Chess Set</td>
                  <td className="py-2">Games</td>
                  <td className="py-2">table</td>
                  <td className="py-2">Main Table</td>
                  <td className="py-2"></td>
                  <td className="py-2"></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default CsvProductUpload;