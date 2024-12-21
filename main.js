const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

function normalizePath(filePath) {
  return path.normalize(filePath).replace(/\\/g, path.sep);
}

function createWindow() {
  console.log(`__dirname ${__dirname}`);
  const win = new BrowserWindow({
    width: 1200,
    height: 1030,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
    
    // 添加加载事件监听
    win.webContents.on('did-start-loading', () => {
      console.log('开始加载页面...');
    });
    
    win.webContents.on('did-finish-load', () => {
      console.log('页面加载完成');
    });
    
    win.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.log('页面加载失败', errorCode, errorDescription);
      win.loadURL('http://localhost:3000');
    });
  } else {
    win.loadFile(path.join(__dirname, 'build', 'index.html'));
  }
}

app.whenReady().then(createWindow);

ipcMain.on('get-file-size', (event, filePath) => {
  const absolutePath = normalizePath(path.resolve(filePath));
  console.log(`get-file-size Checking file size for: ${absolutePath}`);
  fs.stat(absolutePath, (err, stats) => {
    if (err) {
      console.error(`Error accessing file: ${err.message}`);
      event.reply('file-size-response', `Error: ${err.message}`);
    } else {
      event.reply('file-size-response', `${(stats.size / 1024).toFixed(2)} KB`);
    }
  });
});

ipcMain.on('get-image-dimensions', (event, filePath) => {
  const absolutePath = normalizePath(path.resolve(filePath));
  console.log(`get-image-dimensions Checking image dimensions for: ${absolutePath}`);
  
  // 使用图像库（如 sharp）来获取图像尺寸
  sharp(absolutePath)
    .metadata()
    .then(metadata => {
      const dimensions = `${metadata.width}x${metadata.height}`;
      event.reply('image-dimensions-response', dimensions);
    })
    .catch(err => {
      console.error(`Error accessing image dimensions: ${err.message}`);
      event.reply('image-dimensions-response', `Error: ${err.message}`);
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});