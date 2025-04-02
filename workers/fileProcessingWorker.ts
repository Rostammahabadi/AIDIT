// File processing worker
import * as XLSX from 'xlsx';

// Function to detect data type
const detectType = (value: any) => {
  if (value === undefined || value === null) return "unknown";
  if (typeof value === "number") return "number";
  if (!isNaN(Number(value))) return "number";
  if (Date.parse(String(value))) return "date";
  return "string";
};

// Function to analyze JSON structure
function analyzeJsonStructure(obj: any, depth = 0) {
  const result = { depth, arrays: 0, objects: 0, totalKeys: 0 };
  if (Array.isArray(obj)) {
    result.arrays++;
    obj.forEach(item => {
      const sub = analyzeJsonStructure(item, depth + 1);
      result.arrays += sub.arrays;
      result.objects += sub.objects;
      result.totalKeys += sub.totalKeys;
    });
  } else if (typeof obj === "object" && obj !== null) {
    result.objects++;
    result.totalKeys += Object.keys(obj).length;
    Object.values(obj).forEach(val => {
      const sub = analyzeJsonStructure(val, depth + 1);
      result.arrays += sub.arrays;
      result.objects += sub.objects;
      result.totalKeys += sub.totalKeys;
    });
  }
  return result;
}

// Process spreadsheet files
async function processSpreadsheet(arrayBuffer: ArrayBuffer) {
  try {
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get the first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    // Extract headers (first row) and sample rows (next few rows)
    const headers = jsonData[0] || [];
    const sampleRows = jsonData.slice(1, 4); // Get up to 3 sample rows
    
    // Detect column types based on the first row of data
    const columnTypes = headers.map((header: any, i: number) => ({
      name: header,
      type: sampleRows.length > 0 && i < sampleRows[0].length ? detectType(sampleRows[0][i]) : "unknown"
    }));
    
    return {
      type: "spreadsheet",
      headers: headers,
      sampleRows: sampleRows,
      sheetCount: workbook.SheetNames.length,
      rowCount: jsonData.length - 1, // Subtract 1 for header row
      sheetNames: workbook.SheetNames,
      columnTypes: columnTypes
    };
  } catch (error) {
    console.error("Error processing spreadsheet:", error);
    return {
      type: "spreadsheet",
      error: "Failed to parse spreadsheet"
    };
  }
}

// Process JSON files
async function processJson(text: string) {
  try {
    const parsed = JSON.parse(text);
    const structure = analyzeJsonStructure(parsed);
    return {
      type: "json",
      keys: Object.keys(parsed),
      depth: structure.depth,
      isArray: Array.isArray(parsed),
      itemCount: Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length,
      sample: JSON.stringify(parsed).substring(0, 200) + "...",
      nestedArrays: structure.arrays,
      nestedObjects: structure.objects,
      totalKeyValues: structure.totalKeys
    };
  } catch (e) {
    return {
      type: "json",
      error: "Invalid JSON"
    };
  }
}

// Process text files
async function processText(text: string) {
  return {
    type: "text",
    preview: text.substring(0, 500), // First 500 chars
    length: text.length,
    lineCount: text.split('\n').length
  };
}

// Main message handler
self.onmessage = async (e) => {
  const { file, fileType, arrayBuffer, text } = e.data;
  
  try {
    let result;
    
    if (fileType === 'spreadsheet') {
      result = await processSpreadsheet(arrayBuffer);
    } else if (fileType === 'json') {
      result = await processJson(text);
    } else if (fileType === 'text') {
      result = await processText(text);
    } else {
      result = { type: 'unknown', error: 'Unsupported file type in worker' };
    }
    
    self.postMessage({
      status: 'success',
      result,
      fileName: file.name
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    self.postMessage({
      status: 'error',
      error: errorMessage,
      fileName: file.name
    });
  }
};

export {}; // This is needed to make TypeScript treat this as a module
