// Worker utility functions

// Function to create a worker and process a file
export const processFileInWorker = (file: File): Promise<any> => {
  return new Promise((resolve, reject) => {
    // Create a new worker
    // Note: In a production environment, you would use a more sophisticated approach
    // to worker creation and management
    const worker = new Worker(new URL('../workers/fileProcessingWorker.ts', import.meta.url));
    
    // Handle messages from the worker
    worker.onmessage = (e) => {
      if (e.data.status === 'success') {
        resolve(e.data.result);
      } else {
        reject(new Error(e.data.error));
      }
      // Terminate the worker after use
      worker.terminate();
    };
    
    // Handle errors
    worker.onerror = (error) => {
      console.error('Worker error:', error);
      reject(error);
      worker.terminate();
    };
    
    // Determine file type
    let fileType = 'unknown';
    if (file.type.includes("spreadsheet") || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
      fileType = 'spreadsheet';
    } else if (file.type === "application/json" || file.name.endsWith('.json')) {
      fileType = 'json';
    } else if (file.type === "text/plain" || file.name.endsWith('.txt')) {
      fileType = 'text';
    }
    
    // Read file content
    const reader = new FileReader();
    
    reader.onload = async (event) => {
      const arrayBuffer = event.target?.result as ArrayBuffer;
      let text = '';
      
      if (fileType === 'json' || fileType === 'text') {
        text = new TextDecoder().decode(arrayBuffer);
      }
      
      // Send data to worker
      worker.postMessage({
        file,
        fileType,
        arrayBuffer,
        text
      });
    };
    
    reader.onerror = (error) => {
      reject(error);
    };
    
    // Read the file as an ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
};

// Function to process files in chunks to avoid UI blocking
export const processFilesInChunks = async (
  files: File[], 
  chunkSize: number = 2, 
  onProgress: (processed: number, total: number) => void
): Promise<any[]> => {
  const results: any[] = [];
  const total = files.length;
  let processed = 0;
  
  // Process files in chunks
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = files.slice(i, i + chunkSize);
    
    // Process chunk in parallel
    const chunkPromises = chunk.map(file => processFileInWorker(file));
    const chunkResults = await Promise.all(chunkPromises);
    
    results.push(...chunkResults);
    processed += chunk.length;
    
    // Report progress
    onProgress(processed, total);
    
    // Small delay to allow UI updates
    if (i + chunkSize < total) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
  
  return results;
};
