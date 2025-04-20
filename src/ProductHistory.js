// ProductHistory.js
import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Card, CardHeader, CardTitle, CardContent } from './components/ui/card';
import { Alert, AlertDescription } from './components/ui/alert';
import { Clock, ArrowRight, RefreshCcw } from 'lucide-react';

const ProductHistory = ({ productId, onClose }) => {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isIndexBuilding, setIsIndexBuilding] = useState(false);

  useEffect(() => {
    if (!productId) return;

    let unsubscribe;
    const fetchHistory = () => {
      setIsLoading(true);
      setError(null);

      try {
        const historyRef = collection(db, 'productHistory');
        // Try simpler query first if we've had errors
        const q = retryCount > 0 
          ? query(
              historyRef,
              where('productId', '==', productId),
              limit(10)
            )
          : query(
              historyRef,
              where('productId', '==', productId),
              orderBy('timestamp', 'desc'),
              limit(10)
            );

        unsubscribe = onSnapshot(q, 
          (snapshot) => {
            const historyData = [];
            snapshot.forEach((doc) => {
              historyData.push({ id: doc.id, ...doc.data() });
            });
            // If we're using the simple query, sort the data in memory
            if (retryCount > 0) {
              historyData.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());
            }
            setHistory(historyData);
            setIsLoading(false);
            setError(null);
            setIsIndexBuilding(false);
          },
          (error) => {
            console.error('History query error:', error);
            if (error.code === 'failed-precondition') {
              setIsIndexBuilding(true);
              // Retry with simpler query if index is building
              if (retryCount === 0) {
                setRetryCount(prev => prev + 1);
              }
            } else {
              setError(error.message);
            }
            setIsLoading(false);
          }
        );
      } catch (error) {
        console.error('Error setting up history listener:', error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    fetchHistory();
    return () => unsubscribe?.();
  }, [productId, retryCount]);

  const handleRetry = () => {
    setRetryCount(0);
    setIsIndexBuilding(false);
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const formatLocation = (location) => {
    if (!location) return '';
    let formatted = `${location.type} - ${location.position}`;
    if (location.subPosition) {
      formatted += ` - ${location.subPosition}`;
    }
    return formatted;
  };

  if (!productId) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Location History</CardTitle>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertDescription>
                <div className="flex flex-col items-center gap-2">
                  <p>Error loading history: {error}</p>
                  <button
                    onClick={handleRetry}
                    className="flex items-center gap-2 px-4 py-2 bg-red-100 rounded hover:bg-red-200"
                  >
                    <RefreshCcw size={16} /> Retry
                  </button>
                </div>
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-4">
              {isIndexBuilding && (
                <Alert>
                  <AlertDescription className="flex items-center justify-between">
                    <span>Setting up history tracking. Some recent changes might not appear immediately.</span>
                    <button
                      onClick={handleRetry}
                      className="flex items-center gap-2 px-3 py-1 bg-blue-100 rounded hover:bg-blue-200"
                    >
                      <RefreshCcw size={16} /> Check Again
                    </button>
                  </AlertDescription>
                </Alert>
              )}
              {history.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No history available</p>
              ) : (
                history.map((record, index) => (
                  <div 
                    key={record.id}
                    className="relative pl-6 pb-4"
                  >
                    {index !== history.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200"></div>
                    )}
                    <div className="flex items-start gap-4">
                      <div className="absolute left-0 top-1.5">
                        <Clock size={16} className="text-gray-400" />
                      </div>
                      <div className="flex-1 bg-gray-50 rounded-lg p-3">
                        <div className="text-sm text-gray-500 mb-1">
                          {formatDate(record.timestamp)}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">
                            {formatLocation(record.previousLocation)}
                          </span>
                          <ArrowRight size={16} className="text-gray-400" />
                          <span className="font-medium">
                            {formatLocation(record.newLocation)}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Moved by: {record.movedBy}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductHistory;