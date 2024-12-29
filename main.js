const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const sharp = require('sharp');

sharp.cache(false); // 禁用缓存以避免潜在的内存问题
sharp.simd(true);   // 启用 SIMD 优化

// 可选：添加错误处理
sharp.queue.on('error', function(err) {
  console.error('Sharp queue error:', err);
});

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
    // 生产环境加载打包后的文件
    const indexPath = path.join(__dirname, './build/index.html');
    console.log('Loading production file:', indexPath);
    win.loadFile(indexPath).catch(err => {
      console.error('Failed to load index.html:', err);
    });
  }
}

app.whenReady().then(createWindow);

// 添加缓存相关的代码
const imageCache = new Map();
const similarityCache = new Map();

// 修改缓存相关的常量
const CACHE_FILE_NAME = 'image-cache.json';
const CACHE_VERSION = '1.0';

// 获取缓存文件路径
function getCacheFilePath(directoryPath) {
  // 使用目录路径的哈希值作为缓存文件名的一部分，以支持多目录
  const directoryHash = require('crypto').createHash('md5').update(directoryPath).digest('hex');
  const cacheFileName = `${directoryHash}-${CACHE_FILE_NAME}`;
  return path.join(app.getPath('cache'), 'iconfinder', cacheFileName);
}

// 确保缓存目录存在
function ensureCacheDirectory() {
  const cacheDir = path.join(app.getPath('cache'), 'iconfinder');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
  return cacheDir;
}

// 修改缓存初始化函数
async function initializeImageCache(directoryPath) {
  try {
    console.log('Initializing image cache...');
    imageCache.clear();
    similarityCache.clear();

    // 确保缓存目录存在
    ensureCacheDirectory();

    // 获取缓存文件路径
    const cacheFilePath = getCacheFilePath(directoryPath);
    let existingCache = null;
    try {
      const cacheData = await fsPromises.readFile(cacheFilePath, 'utf8');
      existingCache = JSON.parse(cacheData);
      console.log('Found existing cache file');
    } catch (error) {
      console.log('No existing cache found or cache invalid');
    }

    // 获取所有图片文件
    const files = await getAllImageFiles(directoryPath);
    console.log(`Found ${files.length} image files`);
    
    // 发送总文件数
    const sender = BrowserWindow.getFocusedWindow()?.webContents;
    sender?.send('cache-init-progress', {
      type: 'start',
      total: files.length
    });

    // 处理每个文件
    let processed = 0;
    for (const filePath of files) {
      try {
        const stats = await fsPromises.stat(filePath);
        const lastModified = stats.mtime.getTime();

        // 检查缓存是否有效
        if (existingCache && 
            existingCache.files[filePath] && 
            existingCache.files[filePath].lastModified === lastModified &&
            existingCache.version === CACHE_VERSION) {
          // 使用缓存数据
          imageCache.set(filePath, existingCache.files[filePath]);
          console.log(`Using cached data for ${path.basename(filePath)}`);
        } else {
          // 计算新的特征
          console.log(`Processing ${path.basename(filePath)}...`);
          const metadata = await sharp(filePath).metadata();
          const features = await getImageFeatures(filePath);

          // 保存到缓存
          imageCache.set(filePath, {
            dimensions: `${metadata.width}x${metadata.height}`,
            size: `${(stats.size / 1024).toFixed(2)} KB`,
            features: features,
            lastModified: lastModified
          });
        }

        // 更新进度
        processed++;
        sender?.send('cache-init-progress', {
          type: 'progress',
          current: processed,
          total: files.length,
          file: path.basename(filePath)
        });

      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);
        // 发送错误信息但继续处理
        sender?.send('cache-init-progress', {
          type: 'error',
          file: path.basename(filePath),
          error: error.message
        });
      }
    }

    // 保存缓存到文件
    await saveCacheToFile(directoryPath);
    console.log('Cache initialization completed');
    
    // 发送完成消息
    sender?.send('cache-init-progress', {
      type: 'complete',
      total: files.length
    });

    return true;
  } catch (error) {
    console.error('Error initializing cache:', error);
    // 发送错误消息
    const sender = BrowserWindow.getFocusedWindow()?.webContents;
    sender?.send('cache-init-progress', {
      type: 'error',
      error: error.message
    });
    throw error;
  }
}

// 修改缓存保存函数
async function saveCacheToFile(directoryPath) {
  const cacheFilePath = getCacheFilePath(directoryPath);
  const cacheData = {
    version: CACHE_VERSION,
    timestamp: Date.now(),
    files: Object.fromEntries(imageCache)
  };

  try {
    await fsPromises.writeFile(cacheFilePath, JSON.stringify(cacheData, null, 2));
    console.log('Cache saved to file:', cacheFilePath);
  } catch (error) {
    console.error('Error saving cache:', error);
    throw error;
  }
}

// 修改递归获取图片文件的函数
async function getAllImageFiles(dirPath) {
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
  let results = [];

  async function traverse(currentPath) {
    const files = await fsPromises.readdir(currentPath, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(currentPath, file.name);
      
      if (file.isDirectory()) {
        await traverse(fullPath);
      } else if (imageExtensions.includes(path.extname(file.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  }

  await traverse(dirPath);
  return results;
}

// 修改相似度计算函数以使用缓存
async function calculateSimilarityWithCache(sourcePath, targetPath, weights) {
  const cacheKey = `${sourcePath}|${targetPath}|${weights.colorWeight}|${weights.shapeWeight}`;
  
  // 检查缓存是否存在且有效
  if (similarityCache.has(cacheKey)) {
    console.log('Using cached similarity result');
    return similarityCache.get(cacheKey);
  } else {
    console.log('No cached similarity result found');
  }

  // 获取或计算源图片特征
  let sourceFeatures = imageCache.get(sourcePath)?.features;
  if (!sourceFeatures) {
    console.log('Computing features for source image');
    sourceFeatures = await getImageFeatures(sourcePath);
  } else {
    console.log('Using cached features for source image');
  }

  // 获取或计算目标图片特征
  let targetFeatures = imageCache.get(targetPath)?.features;
  if (!targetFeatures) {
    console.log('Computing features for target image');
    targetFeatures = await getImageFeatures(targetPath);
  } else {
    console.log('Using cached features for target image');
  }

  // 计算相似度
  const result = calculateSimilarityFromFeatures(sourceFeatures, targetFeatures, weights);
  
  // 缓存计算结果
  similarityCache.set(cacheKey, result);
  
  return result;
}

// 修改缓存重建函数
async function rebuildCache(directoryPath) {
  try {
    console.log('Rebuilding cache for directory:', directoryPath);
    
    // 清除内存中的缓存
    imageCache.clear();
    similarityCache.clear();

    // 删除缓存文件
    const cacheFilePath = getCacheFilePath(directoryPath);
    try {
      await fsPromises.unlink(cacheFilePath);
      console.log('Existing cache file deleted');
    } catch (error) {
      // 如果文件不存在，忽略错误
      if (error.code !== 'ENOENT') {
        console.error('Error deleting cache file:', error);
      }
    }

    // 重新初始化缓存
    return await initializeImageCache(directoryPath);
  } catch (error) {
    console.error('Error rebuilding cache:', error);
    throw error;
  }
}

// 添加新的 IPC 处理器
ipcMain.handle('initialize-image-cache', async (event, directoryPath) => {
  return await initializeImageCache(directoryPath);
});

// 修改现有的文件大小和尺寸获取处理器以使用缓存
ipcMain.on('get-file-size', async (event, filePath) => {
  const absolutePath = normalizePath(filePath);
  try {
    if (imageCache.has(absolutePath)) {
      event.reply('file-size-response', imageCache.get(absolutePath).size);
    } else {
      const stats = await fsPromises.stat(absolutePath);
      const size = `${(stats.size / 1024).toFixed(2)} KB`;
      event.reply('file-size-response', size);
    }
  } catch (err) {
    console.error(`Error accessing file: ${err.message}`);
    event.reply('file-size-response', `Error: ${err.message}`);
  }
});

ipcMain.on('get-image-dimensions', (event, filePath) => {
  const absolutePath = normalizePath(filePath);
  try {
    if (imageCache.has(absolutePath)) {
      event.reply('image-dimensions-response', imageCache.get(absolutePath).dimensions);
    } else {
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
    }
  } catch (err) {
    console.error(`Error accessing image dimensions: ${err.message}`);
    event.reply('image-dimensions-response', `Error: ${err.message}`);
  }
});

// 修改计算相似度的处理器以使用缓存
ipcMain.handle('calculate-similarity', async (event, sourcePath, targetPath, weights) => {
  try {
    return await calculateSimilarityWithCache(sourcePath, targetPath, weights);
  } catch (error) {
    console.error('Error calculating similarity:', error);
    throw error;
  }
});

// 添加获取图片特征的函数
async function getImageFeatures(imagePath) {
  try {
    const image = sharp(imagePath);
    const metadata = await image.metadata();
    
    // 增加分析尺寸以提高精度
    const resizedImage = await image
      .resize(128, 128, { fit: 'fill' })  // 增加到 128x128 以提高精度
      .removeAlpha()
      .raw()
      .toBuffer();

    // 计算颜色直方图
    const histogram = new Array(768).fill(0);
    let dominantColors = new Array(3).fill(0);
    let pixelCount = 0;
    
    // 添加圆角检测
    const cornerPixels = {
      topLeft: [],
      topRight: [],
      bottomLeft: [],
      bottomRight: []
    };
    
    const cornerSize = 16; // 检测区域大小
    
    for (let y = 0; y < 128; y++) {
      for (let x = 0; x < 128; x++) {
        const i = (y * 128 + x) * 3;
        const r = resizedImage[i];
        const g = resizedImage[i + 1];
        const b = resizedImage[i + 2];
        
        // 更新直方图和主色调
        histogram[r]++;
        histogram[256 + g]++;
        histogram[512 + b]++;
        dominantColors[0] += r;
        dominantColors[1] += g;
        dominantColors[2] += b;
        pixelCount++;
        
        // 检测四个角落的像素
        if (x < cornerSize && y < cornerSize) {
          // 左上角
          cornerPixels.topLeft.push([r, g, b]);
        } else if (x >= 128 - cornerSize && y < cornerSize) {
          // 右上角
          cornerPixels.topRight.push([r, g, b]);
        } else if (x < cornerSize && y >= 128 - cornerSize) {
          // 左下角
          cornerPixels.bottomLeft.push([r, g, b]);
        } else if (x >= 128 - cornerSize && y >= 128 - cornerSize) {
          // 右下角
          cornerPixels.bottomRight.push([r, g, b]);
        }
      }
    }
    
    // 分析每个角落是否为圆角
    const cornerFeatures = {};
    for (const [corner, pixels] of Object.entries(cornerPixels)) {
      // 计算角落像素的方差
      const avgColor = pixels.reduce((acc, pixel) => [
        acc[0] + pixel[0],
        acc[1] + pixel[1],
        acc[2] + pixel[2]
      ], [0, 0, 0]).map(sum => sum / pixels.length);
      
      // 计算颜色变化的方差
      const variance = pixels.reduce((acc, pixel) => {
        const diff = Math.sqrt(
          Math.pow(pixel[0] - avgColor[0], 2) +
          Math.pow(pixel[1] - avgColor[1], 2) +
          Math.pow(pixel[2] - avgColor[2], 2)
        );
        return acc + diff;
      }, 0) / pixels.length;
      
      // 根据方差判断是否为圆角（方差大说明有明显的颜色变化，可能是圆角）
      cornerFeatures[corner] = variance > 20;
    }
    
    // 计算平均色
    dominantColors = dominantColors.map(sum => Math.round(sum / pixelCount));

    // 归一化直方图
    const sum = histogram.reduce((a, b) => a + b, 0) / 3;
    const normalizedHistogram = histogram.map(v => v / sum);

    return {
      dimensions: [metadata.width, metadata.height],
      aspectRatio: metadata.width / metadata.height,
      histogram: normalizedHistogram,
      dominantColors,
      originalSize: metadata.size,
      cornerFeatures  // 添加圆角特征
    };
  } catch (error) {
    console.error(`Error processing image ${imagePath}:`, error);
    throw error;
  }
}

// 修改颜色直方图相似度计算函数
function calculateHistogramSimilarity(hist1, hist2) {
  let similarity = 0;
  const weights = {
    r: 0.4,  // 红色通道权重
    g: 0.35, // 绿色通道权重
    b: 0.25  // 蓝色通道权重
  };

  // 使用欧几里得距离计算颜色差异
  let rDiff = 0;
  let gDiff = 0;
  let bDiff = 0;

  for (let i = 0; i < 256; i++) {
    // 获取每个通道的值
    const r1 = hist1[i];
    const r2 = hist2[i];
    const g1 = hist1[i + 256];
    const g2 = hist2[i + 256];
    const b1 = hist1[i + 512];
    const b2 = hist2[i + 512];

    // 计算加权的欧几里得距离
    rDiff += weights.r * Math.pow(r1 - r2, 2);
    gDiff += weights.g * Math.pow(g1 - g2, 2);
    bDiff += weights.b * Math.pow(b1 - b2, 2);

    // 考虑颜色的相对分布
    if (r1 > 0 && r2 > 0) {
      similarity += weights.r * Math.min(r1, r2) / Math.max(r1, r2);
    }
    if (g1 > 0 && g2 > 0) {
      similarity += weights.g * Math.min(g1, g2) / Math.max(g1, g2);
    }
    if (b1 > 0 && b2 > 0) {
      similarity += weights.b * Math.min(b1, b2) / Math.max(b1, b2);
    }
  }

  // 计算最终的颜色相似度
  const euclideanSimilarity = 1 - Math.sqrt(rDiff + gDiff + bDiff);
  const distributionSimilarity = similarity / 256;

  // 组合两种相似度计算方法
  const finalSimilarity = (euclideanSimilarity * 0.6 + distributionSimilarity * 0.4);

  // 使用 sigmoid 函数使结果更平滑
  const sigmoid = x => 1 / (1 + Math.exp(-10 * (x - 0.5)));
  
  return sigmoid(finalSimilarity);
}

// 修改形状相似度计算函数
function calculateShapeSimilarity(ratio1, ratio2, dims1, dims2, corners1, corners2) {
  // 完全相同的图片返回1
  if (ratio1 === ratio2 && 
      dims1[0] === dims2[0] && 
      dims1[1] === dims2[1]) {
    return 1;
  }
  
  // 1. 计算宽高比相似度（使用高斯函数使差异更平滑）
  const ratioDiff = Math.abs(ratio1 - ratio2);
  const ratioSimilarity = Math.exp(-(ratioDiff * ratioDiff) / 0.5);
  
  // 2. 计算尺寸相似度
  const [width1, height1] = dims1;
  const [width2, height2] = dims2;
  
  // 2.1 面积相似度（使用对数尺度，并降低其影响）
  const area1 = width1 * height1;
  const area2 = width2 * height2;
  const logArea1 = Math.log(area1);
  const logArea2 = Math.log(area2);
  const areaDiff = Math.abs(logArea1 - logArea2);
  const areaSimilarity = Math.exp(-areaDiff / 20);
  
  // 2.2 边比例相似度（增加其权重）
  const widthRatio = Math.min(width1, width2) / Math.max(width1, width2);
  const heightRatio = Math.min(height1, height2) / Math.max(height1, height2);
  const dimensionSimilarity = Math.pow((widthRatio + heightRatio) / 2, 0.5);
  
  // 2.3 方向一致性
  const isHorizontal1 = width1 > height1;
  const isHorizontal2 = width2 > height2;
  const orientationMatch = isHorizontal1 === isHorizontal2 ? 1 : 0.7;
  
  // 2.4 圆角相似度（新增）
  let cornerSimilarity = 0;
  if (corners1 && corners2) {
    const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'];
    const matchCount = corners.reduce((count, corner) => {
      return count + (corners1[corner] === corners2[corner] ? 1 : 0);
    }, 0);
    cornerSimilarity = matchCount / 4;
  }
  
  // 3. 计算最终的形状相似度（调整权重，加入圆角）
  const sizeSimilarity = (
    areaSimilarity * 0.15 +       // 降低面积相似度权重
    dimensionSimilarity * 0.4 +   // 边比例权重
    orientationMatch * 0.25 +     // 方向一致性权重
    cornerSimilarity * 0.2        // 圆角相似度权重
  );
  
  // 4. 组合宽高比相似度和尺寸相似度
  const shapeSimilarity = (
    ratioSimilarity * 0.7 +
    sizeSimilarity * 0.3
  );
  
  // 5. 应用非线性变换
  const finalSimilarity = Math.pow(shapeSimilarity, 0.7);
  
  // console.log(`Shape similarity calculation:
  //   Ratio Similarity: ${ratioSimilarity.toFixed(4)}
  //   Area Similarity: ${areaSimilarity.toFixed(4)}
  //   Dimension Similarity: ${dimensionSimilarity.toFixed(4)}
  //   Orientation Match: ${orientationMatch}
  //   Corner Similarity: ${cornerSimilarity.toFixed(4)}
  //   Size Similarity: ${sizeSimilarity.toFixed(4)}
  //   Final Shape Similarity: ${finalSimilarity.toFixed(4)}
  // `);
  
  return finalSimilarity;
}

// 添加获取图片预览的 IPC 处理器
ipcMain.handle('get-image-preview', async (event, filePath) => {
  try {
    const data = await fsPromises.readFile(filePath);
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

// 修改最终相似度计算函数
function calculateSimilarityFromFeatures(sourceFeatures, targetFeatures, weights) {
  // 检查是否为完全相同的图片
  const isSameImage = 
    sourceFeatures.dimensions[0] === targetFeatures.dimensions[0] &&
    sourceFeatures.dimensions[1] === targetFeatures.dimensions[1] &&
    sourceFeatures.histogram.every((value, index) => value === targetFeatures.histogram[index]);

  if (isSameImage) {
    // 返回完整的相似度信息对象，而不是简单的数字 1
    return {
      totalSimilarity: 1,
      colorSimilarity: 1,
      shapeSimilarity: 1
    };
  }

  const { colorWeight = 0.7, shapeWeight = 0.3 } = weights;

  const histogramSimilarity = calculateHistogramSimilarity(
    sourceFeatures.histogram,
    targetFeatures.histogram
  );

  const shapeSimilarity = calculateShapeSimilarity(
    sourceFeatures.aspectRatio,
    targetFeatures.aspectRatio,
    sourceFeatures.dimensions,
    targetFeatures.dimensions,
    sourceFeatures.cornerFeatures,
    targetFeatures.cornerFeatures
  );

  // 使用非线性函数调整相似度权重
  let totalSimilarity;
  if (colorWeight >= 0.7) {
    // 颜色优先模式：增强颜色相似度的影响
    const enhancedHistogramSimilarity = Math.pow(histogramSimilarity, 0.7);
    // 减小尺寸差异的惩罚
    const adjustedShapeSimilarity = Math.pow(shapeSimilarity, 1.5);
    totalSimilarity = (colorWeight * enhancedHistogramSimilarity + shapeWeight * adjustedShapeSimilarity);
  } else if (shapeWeight >= 0.7) {
    // 形状优先模式
    const enhancedShapeSimilarity = Math.pow(shapeSimilarity, 0.7);
    totalSimilarity = (colorWeight * histogramSimilarity + shapeWeight * enhancedShapeSimilarity);
  } else {
    // 平衡模式：使用更平滑的加权
    const balancedHistogram = Math.pow(histogramSimilarity, 0.8);
    const balancedShape = Math.pow(shapeSimilarity, 0.8);
    totalSimilarity = (colorWeight * balancedHistogram + shapeWeight * balancedShape);
  }

  // 应用最终的相似度调整
  totalSimilarity = Math.pow(totalSimilarity, 0.9);

  console.log(`Similarity calculation:
    Mode: ${colorWeight >= 0.7 ? 'Color Priority' : shapeWeight >= 0.7 ? 'Shape Priority' : 'Balanced'}
    Color Weight: ${colorWeight.toFixed(2)}
    Shape Weight: ${shapeWeight.toFixed(2)}
    Color Similarity: ${histogramSimilarity.toFixed(4)}
    Shape Similarity: ${shapeSimilarity.toFixed(4)}
    Total Similarity: ${totalSimilarity.toFixed(4)}
    Is Same Image: ${isSameImage}
  `);

  return {
    totalSimilarity,
    colorSimilarity: histogramSimilarity,
    shapeSimilarity
  };
}