// src/LocationAnalyzer.js
import React, { useState, useEffect } from 'react';
import { doc, collection, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';

const LocationAnalyzer = () => {
  const [locationTypes, setLocationTypes] = useState(null);
  const [locationItems, setLocationItems] = useState({
    shelf: {},
    showcase: {},
    table: {},
    string: {}
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // Fetch location types configuration
      const typesUnsubscribe = onSnapshot(
        doc(db, 'locations', 'types'),
        (doc) => {
          if (doc.exists()) {
            setLocationTypes(doc.data());
            console.log('Location types data:', doc.data()); // Debug log
          }
        },
        (error) => {
          console.error("Error fetching location types:", error);
          setError(error.message);
        }
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
            console.log(`${type} items:`, items); // Debug log
          },
          (error) => {
            console.error(`Error fetching ${type} locations:`, error);
            setError(error.message);
          }
        );
      });

      setIsLoading(false);

      // Cleanup subscriptions
      return () => {
        typesUnsubscribe();
        typeUnsubscribes.forEach(unsubscribe => unsubscribe());
      };
    } catch (error) {
      console.error("Error setting up location listeners:", error);
      setError(error.message);
      setIsLoading(false);
    }
  }, []);

  const renderSchemaTable = () => {
    if (!locationTypes?.schemas) return null;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 border text-left">Location Type</th>
              <th className="p-2 border text-left">Display Name</th>
              <th className="p-2 border text-left">Properties</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(locationTypes.schemas).map(([type, schema]) => (
              <tr key={type} className="border-t">
                <td className="p-2 border font-medium">{type}</td>
                <td className="p-2 border">{schema.displayName}</td>
                <td className="p-2 border">
                  <ul className="list-disc list-inside">
                    {Object.entries(schema).map(([key, value]) => {
                      if (key === 'displayName') return null;
                      return (
                        <li key={key} className="text-sm">
                          {key}: {JSON.stringify(value)}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderItemsTable = () => {
    return Object.entries(locationItems).map(([type, items]) => (
      <div key={type} className="mt-4">
        <h3 className="text-lg font-semibold mb-2 capitalize">{type} Items</h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-gray-200">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 border text-left">ID</th>
                <th className="p-2 border text-left">Name</th>
                <th className="p-2 border text-left">Active</th>
                <th className="p-2 border text-left">Properties</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(items).map(([id, item]) => (
                <tr key={id} className="border-t">
                  <td className="p-2 border font-medium">{id}</td>
                  <td className="p-2 border">{item.name}</td>
                  <td className="p-2 border">
                    {item.active ? '✓' : '✗'}
                  </td>
                  <td className="p-2 border">
                    <ul className="list-disc list-inside">
                      {Object.entries(item).map(([key, value]) => {
                        if (['name', 'active'].includes(key)) return null;
                        return (
                          <li key={key} className="text-sm">
                            {key}: {JSON.stringify(value)}
                          </li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error loading location data: {error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Location Structure Analysis</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-4">Location Types & Schemas</h2>
            {renderSchemaTable()}
          </div>
          
          <div>
            <h2 className="text-xl font-semibold mb-4">Location Items</h2>
            {renderItemsTable()}
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-semibold mb-2">Analysis Notes:</h3>
            <ul className="list-disc list-inside space-y-2">
              <li>
                The current implementation has hardcoded location types in the UI components
              </li>
              <li>
                Location schemas are stored in the database but not fully utilized in the code
              </li>
              <li>
                Moving to a fully dynamic system would require refactoring the location
                selectors to use the database schemas
              </li>
              <li>
                The database structure supports additional location types but the UI
                needs to be made more flexible
              </li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LocationAnalyzer;