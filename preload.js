const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electron', {
  getFileSize: (filePath) => {
    return ipcRenderer.invoke('get-file-size', filePath);
  },
  getImageDimensions: (filePath) => {
    return ipcRenderer.invoke('get-image-dimensions', filePath);
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
  checkCacheExists: async (directoryPath) => {
    try {
      return await ipcRenderer.invoke('check-cache-exists', directoryPath);
    } catch (error) {
      console.error('Error checking cache:', error);
      throw error;
    }
  },
  initializeImageCache: async (directoryPath) => {
    try {
      return new Promise((resolve, reject) => {
        const progressHandler = (event, progress) => {
          window.dispatchEvent(new CustomEvent('cache-init-progress', { 
            detail: progress 
          }));

          if (progress.type === 'complete') {
            ipcRenderer.removeListener('cache-init-progress', progressHandler);
            resolve(true);
          } else if (progress.type === 'error') {
            ipcRenderer.removeListener('cache-init-progress', progressHandler);
            reject(new Error(progress.error));
          }
        };

        ipcRenderer.on('cache-init-progress', progressHandler);

        ipcRenderer.invoke('initialize-image-cache', directoryPath).catch(error => {
          ipcRenderer.removeListener('cache-init-progress', progressHandler);
          reject(error);
        });
      });
    } catch (error) {
      console.error('Error initializing image cache:', error);
      throw error;
    }
  },
  rebuildCache: async (directoryPath) => {
    try {
      return await ipcRenderer.invoke('rebuild-cache', directoryPath);
    } catch (error) {
      console.error('Error rebuilding cache:', error);
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

