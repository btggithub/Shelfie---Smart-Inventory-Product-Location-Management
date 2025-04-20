// src\components\ui\tabs.js
import React from 'react';

// Simple tabs component that doesn't use React context
export const Tabs = ({ value, onValueChange, children }) => {
  // Clone children to pass current value
  return (
    <div className="tabs">
      {React.Children.map(children, child => {
        // Pass the activeValue prop to TabsContent components
        if (child.type === TabsContent) {
          return React.cloneElement(child, { activeValue: value });
        }
        return child;
      })}
    </div>
  );
};

export const TabsList = ({ children, className = '' }) => {
  return (
    <div className={`inline-flex rounded-lg bg-gray-100 p-1 ${className}`}>
      {children}
    </div>
  );
};

export const TabsTrigger = ({ value, children, onValueChange, className = '' }) => {
  return (
    <button
      className={`px-3 py-1.5 text-sm font-medium transition-all ${className}`}
      onClick={() => onValueChange(value)}
    >
      {children}
    </button>
  );
};

export const TabsContent = ({ value, activeValue, children, className = '' }) => {
  if (activeValue !== value) {
    return null;
  }
  
  return (
    <div className={className}>
      {children}
    </div>
  );
};