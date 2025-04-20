// src\MoveProductDialog.js
import React, { useState } from 'react';
import { MoveRight } from 'lucide-react';

const MoveProductDialog = ({ 
  isOpen, 
  onClose, 
  onMove, 
  product, 
  locations,
  isLoading,
  isBulkMove = false,
  selectedCount = 0
}) => {
  const [newLocation, setNewLocation] = useState({
    type: '',
    showcase: '', // Add showcase property for showcase selections
    table: '', // Add table property for table selections
    position: '',
    subPosition: ''
  });

  if (!isOpen) return null;

  const renderLocationSelector = () => {
    switch(newLocation.type) {
      case 'shelf':
        return (
          <>
            <select
              className="w-full p-2 border rounded mb-2"
              value={newLocation.position}
              onChange={(e) => setNewLocation({
                ...newLocation,
                position: e.target.value,
                subPosition: ''
              })}
            >
              <option value="">Select Shelf</option>
              {Object.entries(locations.shelves || {}).map(([id, shelf]) => (
                <option key={id} value={id}>
                  {shelf.name || id}
                </option>
              ))}
            </select>

            {newLocation.position && locations.shelves[newLocation.position]?.racks && (
              <select
                className="w-full p-2 border rounded"
                value={newLocation.subPosition}
                onChange={(e) => setNewLocation({
                  ...newLocation,
                  subPosition: e.target.value
                })}
              >
                <option value="">Select Rack</option>
                {locations.shelves[newLocation.position].racks.map(rack => (
                  <option key={rack} value={rack}>{rack}</option>
                ))}
              </select>
            )}
          </>
        );

      case 'showcase':
        return (
          <>
            <select
              className="w-full p-2 border rounded mb-2"
              value={newLocation.showcase}
              onChange={(e) => setNewLocation({
                ...newLocation,
                showcase: e.target.value,
                position: '',
                subPosition: ''
              })}
            >
              <option value="">Select Showcase</option>
              {Object.entries(locations.showcases || {}).map(([id, showcase]) => (
                <option key={id} value={id}>
                  {showcase.name || id}
                </option>
              ))}
            </select>

            {newLocation.showcase && (
              <select
                className="w-full p-2 border rounded mb-2"
                value={newLocation.position}
                onChange={(e) => setNewLocation({
                  ...newLocation,
                  position: e.target.value,
                  subPosition: ''
                })}
              >
                <option value="">Select Showcase Section</option>
                <option value="top">Top Section</option>
                <option value="leftColumn">Left Column</option>
                <option value="rightColumn">Right Column</option>
              </select>
            )}
            
            {newLocation.showcase && newLocation.position && locations.showcases[newLocation.showcase] && (
              <select
                className="w-full p-2 border rounded"
                value={newLocation.subPosition}
                onChange={(e) => setNewLocation({
                  ...newLocation,
                  subPosition: e.target.value
                })}
              >
                <option value="">Select Position</option>
                {newLocation.position === 'top' 
                  ? (locations.showcases[newLocation.showcase].top || []).map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))
                  : (locations.showcases[newLocation.showcase][newLocation.position]?.rows || []).map(row => (
                      <option key={row} value={row}>{row}</option>
                    ))
                }
              </select>
            )}
          </>
        );

      case 'string':
        return (
          <select
            className="w-full p-2 border rounded"
            value={newLocation.position}
            onChange={(e) => setNewLocation({
              ...newLocation,
              position: e.target.value,
              subPosition: ''
            })}
          >
            <option value="">Select String</option>
            {(locations.strings || []).map(string => (
              <option key={string} value={string}>{string}</option>
            ))}
          </select>
        );

      case 'table':
        return (
          <>
            <select
              className="w-full p-2 border rounded"
              value={newLocation.table}
              onChange={(e) => setNewLocation({
                ...newLocation,
                table: e.target.value,
                position: 'top', // Default position for tables is 'top'
                subPosition: ''
              })}
            >
              <option value="">Select Table</option>
              {Object.entries(locations.tables || {}).map(([id, table]) => (
                <option key={id} value={id}>
                  {table.name || id}
                </option>
              ))}
            </select>
          </>
        );

      default:
        return null;
    }
  };

  const handleMove = () => {
    if (!newLocation.type) return;
    
    // Create the appropriate location object based on the type
    let finalLocation = { type: newLocation.type };
    
    switch(newLocation.type) {
      case 'shelf':
        if (!newLocation.position || !newLocation.subPosition) return;
        finalLocation.position = newLocation.position;
        finalLocation.subPosition = newLocation.subPosition;
        break;
        
      case 'showcase':
        if (!newLocation.showcase || !newLocation.position || !newLocation.subPosition) return;
        finalLocation.showcase = newLocation.showcase;
        finalLocation.position = newLocation.position;
        finalLocation.subPosition = newLocation.subPosition;
        break;
        
      case 'string':
        if (!newLocation.position) return;
        finalLocation.position = newLocation.position;
        break;
        
      case 'table':
        if (!newLocation.table) return;
        finalLocation.table = newLocation.table;
        finalLocation.position = 'top';
        break;
        
      default:
        return;
    }
    
    onMove(product?.id, finalLocation);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {isBulkMove ? 'Move Multiple Products' : 'Move Product'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-4">
          {isBulkMove ? (
            <p className="text-gray-600">
              Moving {selectedCount} products
            </p>
          ) : (
            <p className="text-gray-600">
              Moving "{product?.name}"
            </p>
          )}
          
          {!isBulkMove && (
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1 p-2 bg-gray-50 rounded">
                <p className="text-sm font-medium">Current Location:</p>
                <p className="text-sm text-gray-600">
                  {product?.location.type} - {product?.location.position}
                  {product?.location.subPosition && ` - ${product?.location.subPosition}`}
                </p>
              </div>
              <MoveRight className="text-gray-400" />
              <div className="flex-1 p-2 bg-blue-50 rounded">
                <p className="text-sm font-medium">New Location:</p>
                <p className="text-sm text-gray-600">
                  {newLocation.type === 'showcase' && newLocation.showcase && 
                    `${newLocation.type} - ${locations.showcases[newLocation.showcase]?.name || newLocation.showcase} - ${newLocation.position}`}
                  {newLocation.type === 'table' && newLocation.table && 
                    `${newLocation.type} - ${locations.tables[newLocation.table]?.name || newLocation.table}`}
                  {newLocation.type === 'shelf' && 
                    `${newLocation.type} - ${locations.shelves[newLocation.position]?.name || newLocation.position}`}
                  {newLocation.type === 'string' && 
                    `${newLocation.type} - ${newLocation.position}`}
                  {newLocation.subPosition && ` - ${newLocation.subPosition}`}
                </p>
              </div>
            </div>
          )}

          <select
            className="w-full p-2 border rounded mb-2"
            value={newLocation.type}
            onChange={(e) => setNewLocation({
              type: e.target.value,
              position: '',
              showcase: '',
              table: '',
              subPosition: ''
            })}
          >
            <option value="">Select Location Type</option>
            <option value="shelf">Shelf</option>
            <option value="showcase">Showcase</option>
            <option value="string">String</option>
            <option value="table">Table</option>
          </select>

          {renderLocationSelector()}

          <div className="flex gap-2 justify-end mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleMove}
              disabled={isLoading || !newLocation.type}
              className={`px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 
                ${(isLoading || !newLocation.type) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? 'Moving...' : isBulkMove ? 'Move Products' : 'Move Product'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MoveProductDialog;