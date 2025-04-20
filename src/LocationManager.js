// src\LocationManager.js
import { useOutletContext } from 'react-router-dom';
import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, updateDoc, query, onSnapshot, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Plus, Edit2, Save, X, Trash2 } from 'lucide-react';

const LocationManager = () => {
  const { user } = useOutletContext();
  const [locations, setLocations] = useState({
    shelf: [],
    showcase: [],
    table: [],
    string: []
  });
  
  const [newLocation, setNewLocation] = useState({
    type: '',
    identifier: '',
    name: '',
    properties: {}
  });
  
  const [editingLocation, setEditingLocation] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Location type definitions
  const locationTypes = {
    shelf: {
      display: 'Shelf',
      properties: {
        racks: {
          type: 'array',
          default: ['Rack 1', 'Rack 2', 'Rack 3', 'Top'],
          label: 'Rack Names'
        },
        order: {
          type: 'number',
          default: 1,
          label: 'Display Order'
        },
        name: {
          type: 'string',
          label: 'Display Name'
        }
      }
    },
    showcase: {
      display: 'Showcase',
      properties: {
        positions: {
          type: 'object',
          default: {
            top: ['Top Left', 'Top Right'],
            leftColumn: ['Upper', 'Middle', 'Lower'],
            rightColumn: ['Upper', 'Middle', 'Lower']
          },
          label: 'Position Configuration'
        },
        order: {
          type: 'number',
          default: 1,
          label: 'Display Order'
        }
      }
    },
    table: {
      display: 'Table',
      properties: {
        positions: {
          type: 'array',
          default: ['top'],
          label: 'Available Positions'
        },
        name: {
          type: 'string',
          label: 'Display Name'
        },
        order: {
          type: 'number',
          default: 1,
          label: 'Display Order'
        }
      }
    },
    string: {
      display: 'String',
      properties: {
        order: {
          type: 'number',
          default: 1,
          label: 'Display Order'
        }
      }
    }
  };

  // Load locations
  useEffect(() => {
    const unsubscribes = Object.keys(locationTypes).map(type => {
      const locationsRef = collection(db, 'locations', type, 'items');
      const q = query(locationsRef);

      return onSnapshot(q, (snapshot) => {
        const locationsData = [];
        snapshot.forEach((doc) => {
          locationsData.push({ id: doc.id, ...doc.data() });
        });
        setLocations(prev => ({
          ...prev,
          [type]: locationsData.sort((a, b) => a.order - b.order)
        }));
      });
    });

    return () => unsubscribes.forEach(unsubscribe => unsubscribe());
  }, []);

  const handleAddLocation = async () => {
    try {
      if (!newLocation.type || !newLocation.identifier || !newLocation.name) {
        setError('Location type, identifier, and name are required');
        return;
      }

      // Validate identifier format (lowercase, no spaces, only letters and numbers)
      if (!/^[a-z0-9]+$/.test(newLocation.identifier)) {
        setError('Identifier must contain only lowercase letters and numbers, no spaces or special characters');
        return;
      }

      // Check length
      if (newLocation.identifier.length < 3 || newLocation.identifier.length > 20) {
        setError('Identifier must be between 3 and 20 characters');
        return;
      }

      // Check if identifier already exists
      const existingLocation = locations[newLocation.type].find(
        loc => loc.identifier === newLocation.identifier
      );
      if (existingLocation) {
        setError('Location identifier already exists');
        return;
      }

      // Initialize default properties based on type
      let typeSpecificProps = {};
      switch(newLocation.type) {
        case 'shelf':
          typeSpecificProps = {
            racks: locationTypes.shelf.properties.racks.default,
            type: 'shelf',
            order: locations[newLocation.type].length + 1,
            name: newLocation.name, // This is important for the UI transformation
            identifier: newLocation.identifier // This is important for the UI transformation
          };
          break;        
          case 'showcase':
          typeSpecificProps = {
            positions: {
              top: ['Top Left', 'Top Right'],
              leftColumn: ['Upper', 'Middle', 'Lower'],
              rightColumn: ['Upper', 'Middle', 'Lower']
            },
            type: 'showcase',
            order: locations[newLocation.type].length + 1,
            identifier: newLocation.identifier,
            name: newLocation.name,
            active: true
          };
          break;
          case 'table':
            typeSpecificProps = {
              positions: ['top'],
              type: 'table',
              order: locations[newLocation.type].length + 1,
              identifier: newLocation.identifier,
              name: newLocation.name,
              active: true
            };
            break;
        case 'string':
          typeSpecificProps = {
            type: 'string',
            order: locations[newLocation.type].length + 1,
            identifier: newLocation.identifier
          };
          break;
      }

      const locationData = {
        identifier: newLocation.identifier,
        type: newLocation.type,
        name: newLocation.name,
        order: locations[newLocation.type].length + 1,
        active: true,
        lastUpdated: new Date(),
        ...typeSpecificProps
      };

      // Use setDoc instead of addDoc to specify the document ID
      const locationRef = doc(db, 'locations', newLocation.type, 'items', newLocation.identifier);
      await setDoc(locationRef, locationData);

      // Reset form and show success message
      setNewLocation({
        type: '',
        identifier: '',
        name: '',
        properties: {}
      });
      setSuccess('Location added successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error adding location: ' + error.message);
    }
  };

  const handleUpdateLocation = async (type, locationId) => {
    try {
      if (!editingLocation.name) {
        setError('Location name is required');
        return;
      }
      
      // Validate structure based on type
      switch(type) {
        case 'shelf':
          if (!Array.isArray(editingLocation.racks) || editingLocation.racks.length === 0) {
            setError('At least one rack is required for shelves');
            return;
          }
          break;
        case 'showcase':
          if (!editingLocation.positions || 
              !editingLocation.positions.top ||
              !editingLocation.positions.leftColumn ||
              !editingLocation.positions.rightColumn) {
            setError('Showcase requires top, left column, and right column positions');
            return;
          }
          break;
        case 'table':
          if (!Array.isArray(editingLocation.positions) || !editingLocation.positions.includes('top')) {
            setError('Table requires at least a top position');
            return;
          }
          break;
      }

      const locationRef = doc(db, 'locations', type, 'items', locationId);
      await updateDoc(locationRef, {
        ...editingLocation,
        lastUpdated: new Date(),
        updatedBy: user.email
      });

      setEditingLocation(null);
      setSuccess('Location updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating location: ' + error.message);
    }
  };

  const toggleLocationStatus = async (type, location) => {
    try {
      const locationRef = doc(db, 'locations', type, 'items', location.id);
      await updateDoc(locationRef, {
        active: !location.active,
        lastUpdated: new Date(),
        updatedBy: user.email
      });
      setSuccess(`Location ${location.active ? 'disabled' : 'enabled'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      setError('Error updating location status: ' + error.message);
    }
  };

  const renderLocationProperties = (type, location) => {
    const typeConfig = locationTypes[type];
    if (!typeConfig) return null;

    return Object.entries(typeConfig.properties).map(([key, config]) => {
      if (config.type === 'array') {
        return (
          <div key={key} className="mt-2">
            <label className="block text-sm font-medium text-gray-700">
              {config.label}
            </label>
            <input
              type="text"
              value={location[key]?.join(', ') || ''}
              onChange={(e) => {
                const values = e.target.value.split(',').map(v => v.trim());
                setEditingLocation(prev => ({
                  ...prev,
                  [key]: values
                }));
              }}
              className="mt-1 w-full p-2 border rounded"
              placeholder="Enter values separated by commas"
            />
          </div>
        );
      }
      // Add more property type renderers as needed
      return null;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Management</CardTitle>
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

          {/* Add new location form */}
          <div className="space-y-2">
            <select
              value={newLocation.type}
              onChange={(e) => setNewLocation({
                ...newLocation,
                type: e.target.value
              })}
              className="w-full p-2 border rounded"
            >
              <option value="">Select Location Type</option>
              {Object.entries(locationTypes).map(([type, config]) => (
                <option key={type} value={type}>{config.display}</option>
              ))}
            </select>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Location Identifier"
                value={newLocation.identifier}
                onChange={(e) => setNewLocation({
                  ...newLocation,
                  identifier: e.target.value
                })}
                className="flex-1 p-2 border rounded"
              />
              <input
                type="text"
                placeholder="Display Name"
                value={newLocation.name}
                onChange={(e) => setNewLocation({
                  ...newLocation,
                  name: e.target.value
                })}
                className="flex-1 p-2 border rounded"
              />
              <button
                onClick={handleAddLocation}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus size={20} />
                Add Location
              </button>
            </div>
          </div>

          {/* Locations list grouped by type */}
          {Object.entries(locationTypes).map(([type, config]) => (
            <div key={type} className="mt-6">
              <h3 className="text-lg font-semibold mb-2">{config.display} Locations</h3>
              <div className="border rounded divide-y">
                {locations[type]?.map(location => (
                  <div
                    key={location.id}
                    className={`p-3 ${!location.active ? 'opacity-50' : ''}`}
                  >
                    {editingLocation?.id === location.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={editingLocation.name}
                            onChange={(e) => setEditingLocation({
                              ...editingLocation,
                              name: e.target.value
                            })}
                            className="flex-1 p-2 border rounded"
                          />
                          <button
                            onClick={() => handleUpdateLocation(type, location.id)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save size={20} />
                          </button>
                          <button
                            onClick={() => setEditingLocation(null)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded"
                          >
                            <X size={20} />
                          </button>
                        </div>
                        {renderLocationProperties(type, editingLocation)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="flex-1 font-medium">
                          {location.name}
                          <span className="text-sm text-gray-500 ml-2">
                            ({location.identifier})
                          </span>
                        </span>
                        <button
                          onClick={() => setEditingLocation(location)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded"
                        >
                          <Edit2 size={20} />
                        </button>
                        <button
                          onClick={() => toggleLocationStatus(type, location)}
                          className={`px-3 py-1 rounded text-sm ${
                            location.active 
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {location.active ? 'Disable' : 'Enable'}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationManager;