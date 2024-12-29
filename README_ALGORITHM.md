# 图片相似度算法说明

本项目使用了基于颜色和形状特征的混合相似度算法，通过组合多个特征来实现更准确的图片相似度匹配。

## 1. 颜色相似度算法

### 1.1 颜色直方图特征
```javascript
// 计算颜色直方图
const histogram = new Array(768).fill(0); // 256*3 for RGB channels
const dominantColors = new Array(3).fill(0);
let pixelCount = 0;

// 遍历图片像素
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 3;
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    
    // 更新直方图
    histogram[r]++;
    histogram[256 + g]++;
    histogram[512 + b]++;
    
    // 累计主色调
    dominantColors[0] += r;
    dominantColors[1] += g;
    dominantColors[2] += b;
    pixelCount++;
  }
}

// 归一化直方图
const normalizedHistogram = histogram.map(v => v / pixelCount);
```

### 1.2 颜色相似度计算
```javascript
function calculateHistogramSimilarity(hist1, hist2) {
  let similarity = 0;
  const weights = {
    r: 0.4,  // 红色通道权重
    g: 0.35, // 绿色通道权重
    b: 0.25  // 蓝色通道权重
  };

  // 计算加权欧几里得距离
  let rDiff = 0, gDiff = 0, bDiff = 0;

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

  // 组合欧几里得距离和分布相似度
  const euclideanSimilarity = 1 - Math.sqrt(rDiff + gDiff + bDiff);
  const distributionSimilarity = similarity / 256;
  
  // 使用sigmoid函数使结果更平滑
  const finalSimilarity = sigmoid(
    euclideanSimilarity * 0.6 + distributionSimilarity * 0.4
  );
  
  return finalSimilarity;
}
```

## 2. 形状相似度算法

### 2.1 形状特征提取
```javascript
const shapeFeatures = {
  dimensions: [width, height],
  aspectRatio: width / height,
  area: width * height,
  orientation: width > height ? 'horizontal' : 'vertical'
};
```

### 2.2 形状相似度计算
```javascript
function calculateShapeSimilarity(ratio1, ratio2, dims1, dims2) {
  // 完全相同的图片返回1
  if (ratio1 === ratio2 && 
      dims1[0] === dims2[0] && 
      dims1[1] === dims2[1]) {
    return 1;
  }
  
  // 1. 宽高比相似度（使用高斯函数）
  const ratioDiff = Math.abs(ratio1 - ratio2);
  const ratioSimilarity = Math.exp(-(ratioDiff * ratioDiff) / 0.5);
  
  // 2. 尺寸相似度计算
  const [width1, height1] = dims1;
  const [width2, height2] = dims2;
  
  // 2.1 面积相似度（使用对数尺度）
  const area1 = width1 * height1;
  const area2 = width2 * height2;
  const logArea1 = Math.log(area1);
  const logArea2 = Math.log(area2);
  const areaDiff = Math.abs(logArea1 - logArea2);
  const areaSimilarity = Math.exp(-areaDiff / 20);
  
  // 2.2 边比例相似度
  const widthRatio = Math.min(width1, width2) / Math.max(width1, width2);
  const heightRatio = Math.min(height1, height2) / Math.max(height1, height2);
  const dimensionSimilarity = Math.pow((widthRatio + heightRatio) / 2, 0.5);
  
  // 2.3 方向一致性
  const isHorizontal1 = width1 > height1;
  const isHorizontal2 = width2 > height2;
  const orientationMatch = isHorizontal1 === isHorizontal2 ? 1 : 0.7;
  
  // 3. 组合所有特征
  const sizeSimilarity = (
    areaSimilarity * 0.15 +      // 面积权重
    dimensionSimilarity * 0.4 +  // 边比例权重
    orientationMatch * 0.25      // 方向权重
  );
  
  // 4. 最终形状相似度
  return Math.pow(
    ratioSimilarity * 0.7 + sizeSimilarity * 0.3,
    0.7  // 幂次调整，使结果更敏感
  );
}
```

## 3. 总体相似度计算

### 3.1 特征权重配置
```javascript
const weights = {
  colorWeight: 0.7,   // 颜色特征权重
  shapeWeight: 0.3    // 形状特征权重
};
```

### 3.2 相似度组合
```javascript
function calculateTotalSimilarity(sourceFeatures, targetFeatures, weights) {
  const { colorWeight = 0.7, shapeWeight = 0.3 } = weights;

  // 计算颜色相似度
  const colorSimilarity = calculateHistogramSimilarity(
    sourceFeatures.histogram,
    targetFeatures.histogram
  );

  // 计算形状相似度
  const shapeSimilarity = calculateShapeSimilarity(
    sourceFeatures.aspectRatio,
    targetFeatures.aspectRatio,
    sourceFeatures.dimensions,
    targetFeatures.dimensions
  );

  // 根据模式调整权重
  let totalSimilarity;
  if (colorWeight >= 0.7) {
    // 颜色优先模式
    const enhancedColorSimilarity = Math.pow(colorSimilarity, 0.7);
    totalSimilarity = (
      colorWeight * enhancedColorSimilarity + 
      shapeWeight * shapeSimilarity
    );
  } else if (shapeWeight >= 0.7) {
    // 形状优先模式
    const enhancedShapeSimilarity = Math.pow(shapeSimilarity, 0.7);
    totalSimilarity = (
      colorWeight * colorSimilarity + 
      shapeWeight * enhancedShapeSimilarity
    );
  } else {
    // 平衡模式
    totalSimilarity = (
      colorWeight * colorSimilarity + 
      shapeWeight * shapeSimilarity
    );
  }

  return {
    totalSimilarity: Math.pow(totalSimilarity, 0.9),
    colorSimilarity,
    shapeSimilarity
  };
}
```

## 4. 性能优化

### 4.1 图片预处理
- 使用 Sharp 库进行图片处理
- 统一调整图片尺寸为 128x128
- 移除 alpha 通道
- 使用 SIMD 优化

### 4.2 缓存策略
- 缓存图片特征到本地文件
- 使用内存缓存加速重复计算
- 分块存储大型目录结构

### 4.3 并行处理
- 使用 Promise.all 并行处理多个图片
- 异步计算相似度
- 分批处理大量图片

## 5. 算法调优

### 5.1 相似度阈值
- 默认阈值设置为 0.5
- 可通过滑块实时调整
- 建议范围：0.3-0.8

### 5.2 权重调整
- 颜色权重：0.7（默认）
- 形状权重：0.3（默认）
- 可根据具体场景调整

### 5.3 优化建议
1. 对于图标匹配，建议增加形状权重
2. 对于照片匹配，建议增加颜色权重
3. 对于大量图片，建议先用较高阈值快速筛选
4. 可以根据图片类型动态调整权重 