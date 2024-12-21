const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

function normalizePath(filePath) {
  if (process.platform === 'win32') {
    // Windows
    return path.normalize(filePath).replace(/\//g, '\\');
  } else {
    // Mac/Linux
    return path.normalize(filePath).replace(/\\/g, '/');
  }
}

function createWindow() {
  console.log(`__dirname ${__dirname}`);
  const win = new BrowserWindow({
    width: 1200,
    height: 1030,
    icon: path.join(__dirname, 'public/logo512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      enableRemoteModule: false,
      nodeIntegration: false,
    },
    autoHideMenuBar: true,
    menuBarVisible: false,
  });

  // win.setMenu(null);

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

ipcMain.on('get-file-size', async (event, filePath) => {
  const absolutePath = normalizePath(filePath);
  console.log(`get-file-size Checking file size for: ${absolutePath}`);
  try {
    const stats = await fs.stat(absolutePath);
    event.reply('file-size-response', `${(stats.size / 1024).toFixed(2)} KB`);
  } catch (err) {
    console.error(`Error accessing file: ${err.message}`);
    event.reply('file-size-response', `Error: ${err.message}`);
  }
});

ipcMain.on('get-image-dimensions', (event, filePath) => {
  const absolutePath = normalizePath(filePath);
  console.log(`get-image-dimensions Checking image dimensions for: ${absolutePath}`);
  
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

// 添加获取图片特征的函数
async function getImageFeatures(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // 缩放图片到统一大小进行比较
    const resizedImage = await image
      .resize(32, 32, { fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer();

    // 计算颜色直方图
    const histogram = new Array(768).fill(0); // 256*3 for RGB
    for (let i = 0; i < resizedImage.length; i += 3) {
      histogram[resizedImage[i]]++; // R
      histogram[256 + resizedImage[i + 1]]++; // G
      histogram[512 + resizedImage[i + 2]]++; // B
    }

    // 归一化直方图
    const sum = histogram.reduce((a, b) => a + b, 0);
    const normalizedHistogram = histogram.map(v => v / sum);

    return {
      dimensions: [metadata.width, metadata.height],
      aspectRatio: metadata.width / metadata.height,
      histogram: normalizedHistogram
    };
  } catch (error) {
    console.error('Error getting image features:', error);
    throw error;
  }
}

// 修改计算相似度的IPC处理器
ipcMain.handle('calculate-similarity', async (event, sourcePath, targetPath, weights = {}) => {
  try {
    const sourceFeatures = await getImageFeatures(sourcePath);
    const targetFeatures = await getImageFeatures(targetPath);

    // 使用传入的权重，如果没有则使用默认值
    const colorWeight = weights.colorWeight ?? 0.7;
    const shapeWeight = weights.shapeWeight ?? 0.3;

    // 计算直方图相似度（巴氏距离）
    const histogramSimilarity = calculateHistogramSimilarity(
      sourceFeatures.histogram,
      targetFeatures.histogram
    );

    // 计算形状相似度（基于宽高比）
    const shapeSimilarity = calculateShapeSimilarity(
      sourceFeatures.aspectRatio,
      targetFeatures.aspectRatio
    );

    // 综合相似度
    const totalSimilarity = (
      colorWeight * histogramSimilarity +
      shapeWeight * shapeSimilarity
    );

    return totalSimilarity;
  } catch (error) {
    console.error('Error calculating similarity:', error);
    throw error;
  }
});

// 计算直方图相似度（巴氏距离）
function calculateHistogramSimilarity(hist1, hist2) {
  let similarity = 0;
  for (let i = 0; i < hist1.length; i++) {
    similarity += Math.sqrt(hist1[i] * hist2[i]);
  }
  return similarity;
}

// 计算形状相似度
function calculateShapeSimilarity(ratio1, ratio2) {
  const minRatio = Math.min(ratio1, ratio2);
  const maxRatio = Math.max(ratio1, ratio2);
  return minRatio / maxRatio;
}

// 添加获取图片预览的 IPC 处理器
ipcMain.handle('get-image-preview', async (event, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    // 获取文件的 MIME 类型
    const mimeType = getMimeType(filePath);
    return `data:${mimeType};base64,${data.toString('base64')}`;
  } catch (error) {
    console.error('Error reading image file:', error);
    throw error;
  }
});

// 辅助函数：根据文件扩展名获取 MIME 类型
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

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