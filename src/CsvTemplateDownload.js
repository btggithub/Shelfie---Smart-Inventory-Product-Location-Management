// src\CsvTemplateDownload.js
import React from 'react';
import { FileDown } from 'lucide-react';

const CsvTemplateDownload = () => {
  // Function to generate the CSV content
  const generateTemplateContent = () => {
    const headers = ['Product Name', 'Category', 'Location Type', 'Location Name', 'Section', 'Position'];
    const examples = [
      ['Silver Bracelet', 'Bangles', 'shelf', 'Back Wall Shelf 1', '', 'Rack 1'],
      ['Gold Ring', 'Earrings', 'showcase', 'Main Showcase', 'top', 'Top Left'],
      ['Crystal Necklace', 'Bangles', 'string', 'String 1', '', ''],
      ['Chess Set', 'Games', 'table', 'Main Table', '', '']
    ];
    
    // Combine headers and examples into CSV
    const csvRows = [
      headers.join(','),
      ...examples.map(row => row.join(','))
    ];
    
    return csvRows.join('\n');
  };
  
  // Function to handle the download
  const handleDownload = () => {
    const csvContent = generateTemplateContent();
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'product_upload_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };
  
  return (
    <button
      onClick={handleDownload}
      className="flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
    >
      <FileDown size={16} />
      Download CSV Template
    </button>
  );
};

export default CsvTemplateDownload;