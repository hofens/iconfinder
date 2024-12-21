const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
  getFileSize: (filePath) => {
    console.log(`getFileSize Attempting to get file size for ${filePath}`);
    return new Promise((resolve, reject) => {
      ipcRenderer.once('file-size-response', (event, size) => {
        console.log(`File size response received for ${filePath}: ${size}`);
        if (size.startsWith('Error:')) {
          console.error(`Error getting file size for ${filePath}: ${size}`);
          reject(new Error(size));
        } else {
          console.log(`File size for ${filePath}: ${size}`);
          resolve(size);
        }
      });
      ipcRenderer.send('get-file-size', filePath);
    });
  },
  getImageDimensions: (filePath) => {
    console.log(`getImageDimensions Attempting to get image dimensions for ${filePath}`);
    return new Promise((resolve, reject) => {
      ipcRenderer.once('image-dimensions-response', (event, dimensions) => {
        console.log(`Image dimensions response received for ${filePath}: ${dimensions}`);
        if (dimensions.startsWith('Error:')) {
          console.error(`Error getting image dimensions for ${filePath}: ${dimensions}`);
          reject(new Error(dimensions));
        } else {
          console.log(`Image dimensions for ${filePath}: ${dimensions}`);
          resolve(dimensions);
        }
      });
      ipcRenderer.send('get-image-dimensions', filePath);
    });
  },
  calculateImageSimilarity: async (sourcePath, targetPath, weights) => {
    try {
      return await ipcRenderer.invoke('calculate-similarity', sourcePath, targetPath, weights);
    } catch (error) {
      console.error('Error calculating similarity:', error);
      throw error;
    }
  },
  getImagePreview: async (filePath) => {
    try {
      const result = await ipcRenderer.invoke('get-image-preview', filePath);
      return result;
    } catch (error) {
      console.error('Error getting image preview:', error);
      throw error;
    }
  },
  initializeImageCache: async (directoryPath) => {
    try {
      return await ipcRenderer.invoke('initialize-image-cache', directoryPath);
    } catch (error) {
      console.error('Error initializing image cache:', error);
      throw error;
    }
  }
});
window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
}); 

