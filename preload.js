const { contextBridge, ipcRenderer } = require('electron');

// 为主窗口暴露的API
const mainApi = {
  getFileSize: (filePath) => ipcRenderer.invoke('get-file-size', filePath),
  getImageDimensions: (filePath) => ipcRenderer.invoke('get-image-dimensions', filePath),
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
  clearImageCache: async (directoryPath) => {
    try {
      return await ipcRenderer.invoke('clear-image-cache', directoryPath);
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error;
    }
  },
  clearDirectory: async (dirPath) => {
    try {
      return await ipcRenderer.invoke('clear-directory', dirPath);
    } catch (error) {
      console.error('Error clearing directory:', error);
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
  },
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  captureScreen: () => ipcRenderer.invoke('start-capture-screen'),
  onScreenCapture: (callback) => ipcRenderer.on('screen-captured', callback),
  removeScreenCapture: (callback) => ipcRenderer.removeListener('screen-captured', callback),
  getCachePath: () => ipcRenderer.invoke('get-cache-path'),
  getScreenshotPath: () => ipcRenderer.invoke('get-screenshot-path'),
  showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path)
};

// 为截图窗口暴露的API
const captureApi = {
  invoke: (channel, ...args) => {
    if (channel === 'capture-screen') {
      return ipcRenderer.invoke('capture-screen', ...args);
    }
    return Promise.reject(new Error('Invalid channel'));
  },
  cancelCaptureScreen: () => ipcRenderer.invoke('cancel-capture-screen')
};

// 根据加载的HTML文件选择要暴露的API
if (window.location.href.includes('capture.html')) {
  contextBridge.exposeInMainWorld('electron', captureApi);
} else {
  contextBridge.exposeInMainWorld('electron', mainApi);
}

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ['chrome', 'node', 'electron']) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
}); 
