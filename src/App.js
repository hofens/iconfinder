import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUpload, FaFolder, FaImage, FaSearch, FaCog } from 'react-icons/fa';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [similarity, setSimilarity] = useState(0.50);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [searchPath, setSearchPath] = useState('');
  const [status, setStatus] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [excludePaths, setExcludePaths] = useState('');
  const [includePaths, setIncludePaths] = useState('');
  const [searchFile, setSearchFile] = useState(null);
  const [directoryStructure, setDirectoryStructure] = useState([]);
  const [similarityTimer, setSimilarityTimer] = useState(null);
  const [showDetailedInfo, setShowDetailedInfo] = useState(false);
  const [resultDirFilter, setResultDirFilter] = useState('');
  const [availableDirs, setAvailableDirs] = useState([]);
  const [cacheProgress, setCacheProgress] = useState(null);
  const [cacheInitialized, setCacheInitialized] = useState(false);

  // Ensure ipcRenderer is available

  
  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('appSettings')) || {};
    setSearchPath(savedSettings.searchPath || '');
    setSimilarity(savedSettings.similarity || 0.50);
    setExcludePaths(savedSettings.excludePaths || '');
    setIncludePaths(savedSettings.includePaths || '');
    setShowDetailedInfo(savedSettings.showDetailedInfo || false);
    // 加载保存的目录结构
    const savedStructure = loadDirectoryStructure();
    setDirectoryStructure(savedStructure);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      searchPath,
      similarity,
      excludePaths,
      includePaths,
      showDetailedInfo,
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [searchPath, similarity, excludePaths, includePaths, showDetailedInfo]);

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    handleFile(file);
  };

  const handleFile = (file) => {
    // 重置之前的状态
    setPreviewUrl(null);
    setSelectedResult(null);
    setSearchResults([]);
    
    if (!file) {
      setStatus('Error: No file selected');
      return;
    }

    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
      };
      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        setStatus('Error: Failed to read file');
      };
      reader.readAsDataURL(file);
      setStatus('Searching for similar images...');
      
      // 先清空 searchFile，确保状态更新
      setSearchFile(null);
      // 使用 setTimeout 确保状态已更新后再设置新的 searchFile
      setTimeout(() => {
        setSearchFile(file);
        searchSimilarImages(file);
      }, 0);
    } else {
      setStatus('Error: Please upload an image file');
      setSelectedFile(null);
      setSearchFile(null);
    }
  };

  async function searchSimilarImages(file, forceRecalculate = false) {
    if (!file || typeof file === 'object' && !file.name) {
      setStatus('无效的文件');
      return;
    }

    let results = [];
    const filePath = window.electron ? file.path : (file.webkitRelativePath || file.name);
    
    // 过滤图片文件
    results = directoryStructure.filter(fileEntry => {
      const isImage = fileEntry.type.startsWith('image/') || 
                     /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileEntry.name);
      return isImage;
    });

    try {
      setStatus('正在计算图片相似度...');
      
      if (forceRecalculate) {
        setSearchResults([]);
      }

      const updatedResults = await Promise.all(results.map(async (fileEntry) => {
        try {
          let size = fileEntry.size;
          let dimensions = fileEntry.dimensions;
          let preview = fileEntry.preview;
          
          let similarityResult = 0;
          if (window.electron) {
            const result = await window.electron.calculateImageSimilarity(
              filePath,
              fileEntry.path,
              { 
                colorWeight: 0.7,
                shapeWeight: 0.3,
              }
            );
            
            similarityResult = (
              result.colorSimilarity * 0.7 + 
              result.shapeSimilarity * 0.3
            );
          } else {
            similarityResult = calculateSimpleSimilarity(file.name, fileEntry.name);
          }

          return {
            path: fileEntry.path,
            name: fileEntry.name,
            size,
            dimensions,
            similarity: similarityResult.toFixed(4),
            preview: preview
          };
        } catch (error) {
          console.error('Error processing file:', fileEntry.name, error);
          return null;
        }
      }));

      const validResults = updatedResults
        .filter(result => result !== null)
        .sort((a, b) => parseFloat(b.similarity) - parseFloat(a.similarity));

      const filteredResults = validResults.filter(
        result => parseFloat(result.similarity) >= similarity
      );

      setSearchResults(filteredResults);
      
      // 更新可用目录列表
      const dirs = new Set();
      filteredResults.forEach(result => {
        const dir = getRelativePath(result.path).split('/').slice(0, -1).join('/');
        if (dir) dirs.add(dir);
      });
      setAvailableDirs(Array.from(dirs).sort());
      
      setStatus(`找到 ${filteredResults.length} 个相似图片`);
    } catch (error) {
      console.error('Search error:', error);
      setStatus('搜索过程中发生错误');
    }
  }

  // Web环境下的简单相似计算
  function calculateSimpleSimilarity(fileName1, fileName2) {
    const name1 = fileName1.toLowerCase();
    const name2 = fileName2.toLowerCase();
    const maxLength = Math.max(name1.length, name2.length);
    let matches = 0;
    
    for (let i = 0; i < Math.min(name1.length, name2.length); i++) {
      if (name1[i] === name2[i]) matches++;
    }
    
    return matches / maxLength;
  }

  // Update getFileSize to use ipcRenderer
  const getFileSize = async (filePath) => {
    if (window.electron) {
      try {
        const size = await window.electron.getFileSize(filePath);
        // return `${(size / 1024).toFixed(2)} KB`;
        // todo
        return size;
      } catch (error) {
        console.error('Error getting file size:', error);
        return 'Unknown size';
      }
    } else {
      const file = directoryStructure.find(f => f.path === filePath);
      return file?.size ? `${(file.size / 1024).toFixed(2)} KB` : 'Unknown size';
    }
  };

  // 辅助函数：获取图片尺寸
  const getImageDimensions = async (filePath) => {
    if (window.electron) {
      try {
        const dimensions = await window.electron.getImageDimensions(filePath);
        return dimensions;
      } catch (error) {
        console.error('Error getting dimensions:', error);
        return 'Unknown dimensions';
      }
    } else {
      try {
        const fileEntry = directoryStructure.find(f => f.path === filePath);
        if (!fileEntry || !fileEntry.blob) return 'Unknown dimensions';

        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve(`${img.naturalWidth}x${img.naturalHeight}`);
            URL.revokeObjectURL(img.src);
          };
          img.onerror = () => {
            resolve('Unknown dimensions');
            URL.revokeObjectURL(img.src);
          };
          img.src = URL.createObjectURL(fileEntry.blob);
        });
      } catch (error) {
        console.error('Error getting dimensions:', error);
        return 'Unknown dimensions';
      }
    }
  };

  // 辅助函数：计算相似度
  const calculateSimilarity = (fileName1, fileName2) => {
    // 这里可以实现相似度计算的逻辑
    // 如，简单的字符串比较或更复杂的算法
    return (fileName1 === fileName2) ? '1.00' : '0.90'; // 示例返回值
  };

  // 辅助函数：获取图片预览
  const getImagePreview = async (file) => {
    try {
      if (file instanceof File) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => {
            console.error('Error reading file:', error);
            reject(error);
          };
          reader.readAsDataURL(file);
        });
      } else if (file.blob) {
        // Web 环境中的 blob 对象
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file.blob);
        });
      } else if (window.electron && file.path) {
        // Electron 环境中的文件路径
        return await window.electron.getImagePreview(file.path);
      } else {
        throw new Error('Unsupported file format');
      }
    } catch (error) {
      console.error('Error in getImagePreview:', error);
      throw error;
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const resetPreview = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedResult(null);
    setSearchResults([]);
    setStatus('');
    setSearchFile(null);
    // 清除文件选择器的值
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const rebuildCache = async () => {
    if (!searchPath.trim()) {
      setStatus('请先选择搜索目录');
      return;
    }

    try {
      setStatus('正在重建缓存...');
      setCacheInitialized(false);  // 重置缓存初始化状态
      
      if (window.electron) {
        await window.electron.rebuildCache(searchPath);
        setStatus('缓存重建完成');
        
        // 重置所有面板状态
        setSelectedFile(null);
        setPreviewUrl(null);
        setSelectedResult(null);
        setSearchResults([]);
        setSearchFile(null);
        setAvailableDirs([]);
        setResultDirFilter('');
        // 清除文件选择器的值
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
          fileInput.value = '';
        }
      }
    } catch (error) {
      console.error('Error rebuilding cache:', error);
      setStatus('缓存重建失败: ' + error.message);
    }
  };

  const handleDoubleClick = (fileName) => {
    navigator.clipboard.writeText(fileName).then(() => {
      setStatus(`Copied: ${fileName}`);
      setTimeout(() => setStatus(''), 2000);
    });
  };

  const handleBrowseDirectory = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        // 重置所有面板状态
        setSelectedFile(null);
        setPreviewUrl(null);
        setSelectedResult(null);
        setSearchResults([]);
        setSearchFile(null);
        setAvailableDirs([]);
        setResultDirFilter('');
        
        setStatus('正在扫描目录...');
        
        // 创建包含和排除的正则表达式
        let includeRegex = null;
        let excludeRegex = null;
        try {
          if (includePaths.trim()) {
            includeRegex = new RegExp(includePaths);
          }
          if (excludePaths.trim()) {
            excludeRegex = new RegExp(excludePaths);
          }
        } catch (error) {
          console.error('正则表达式错误:', error);
          setStatus('正则表达式格式错误，请检查设置');
          return;
        }
        
        // 过滤出图片文件，并应用包含/排除规则
        const imageFiles = files.filter(file => {
          // 首先检查是否为图片文件
          const isImage = file.type.startsWith('image/') || 
                         /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name);
          
          if (!isImage) return false;
          
          // 获取相对路径
          const relativePath = window.electron ? 
            getRelativePath(file.path) : 
            file.webkitRelativePath;
            
          // 检查排除规则
          if (excludeRegex && excludeRegex.test(relativePath)) {
            return false;
          }
          
          // 检查包含规则
          if (includeRegex && !includeRegex.test(relativePath)) {
            return false;
          }
          
          return true;
        });
        
        // 为每个文件创建详细信息
        const structure = await Promise.all(imageFiles.map(async file => {
          let fileInfo = {
            name: file.name,
            path: window.electron ? file.path : (file.webkitRelativePath || file.name),
            type: file.type,
          };

          try {
            if (window.electron) {
              // Electron环境：获取文件信息
              setStatus(`正在处理: ${file.name}`);
              fileInfo.size = await window.electron.getFileSize(file.path);
              fileInfo.dimensions = await window.electron.getImageDimensions(file.path);
              fileInfo.preview = await window.electron.getImagePreview(file.path);
            } else {
              // Web环境：处理文件信息
              fileInfo.size = `${(file.size / 1024).toFixed(2)} KB`;
              fileInfo.blob = file.slice();
              
              // 取图片尺寸
              fileInfo.dimensions = await new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                  resolve(`${img.naturalWidth}x${img.naturalHeight}`);
                  URL.revokeObjectURL(img.src);
                };
                img.onerror = () => {
                  resolve('Unknown dimensions');
                  URL.revokeObjectURL(img.src);
                };
                img.src = URL.createObjectURL(file);
              });

              // 获取预览图
              fileInfo.preview = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(file);
              });
            }
          } catch (error) {
            console.error(`Error processing file ${file.name}:`, error);
            fileInfo.size = 'Unknown size';
            fileInfo.dimensions = 'Unknown dimensions';
            fileInfo.preview = '';
          }

          return fileInfo;
        }));

        setDirectoryStructure(structure);
        
        // 尝试保存目录结构
        if (!saveDirectoryStructure(structure)) {
          setStatus('警告：目录结构过大，无法保存到本地存储。重启应用后需要重新扫描目录。');
        }
        
        // 获取选择的目录路径
        const firstFile = files[0];
        const directoryPath = window.electron 
          ? firstFile.path.substring(0, firstFile.path.lastIndexOf(firstFile.name))
          : firstFile.webkitRelativePath.split('/')[0];
        
        // 更新搜索路径
        setSearchPath(directoryPath);
        
        // 初始化图片缓存
        if (window.electron) {
          try {
            // 每次切换目录时重置缓存初始化状态
            setCacheInitialized(false);
            
            // 检查当前目录的缓存文件是否存在
            const cacheExists = await window.electron.checkCacheExists(directoryPath);
            if (!cacheExists) {
              setStatus('正在初始化图片缓存...');
              await window.electron.initializeImageCache(directoryPath);
            } else {
              setStatus(`目录扫描完成，共发现 ${files.length} 个文件，其中含 ${imageFiles.length} 个图片文件`);
              setCacheInitialized(true);
            }
          } catch (error) {
            console.error('Error initializing image cache:', error);
            setStatus(`目录扫描完成，但缓存初始化失败: ${error.message}`);
          }
        } else {
          setStatus(`目录扫描完成，共发现 ${files.length} 个文件，其中含 ${imageFiles.length} 个图片文件`);
        }
      } else {
        setStatus('未选择任何目录');
        setSearchPath('');
        setDirectoryStructure([]);
        setCacheInitialized(false);  // 重置缓存初始化状态
        // 清除所有分块存储
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key.startsWith('directoryStructure_chunk_')) {
            localStorage.removeItem(key);
          }
        }
        localStorage.removeItem('directoryStructure_chunks');
      }
    };

    input.click();
  };

  const handleSimilarityChange = (e) => {
    const value = e.target.value;
    if (value >= 0 && value <= 1) {
      // 将值四舍五入到4位小数
      const roundedValue = Math.round(value * 10000) / 10000;
      setSimilarity(roundedValue);
      setStatus(`调整相似度为: ${roundedValue.toFixed(4)}`);
      
      if (similarityTimer) {
        clearTimeout(similarityTimer);
      }
      
      const timer = setTimeout(() => {
        if (searchFile) {
          setStatus('开始搜索...');
          searchSimilarImages(searchFile);
        }
      }, 500);
      
      setSimilarityTimer(timer);
    }
  };

  const settingsModal = showSettings && (
    <div className="modal-overlay">
      <div className="modal">
        <h2>搜索设置</h2>
        <div className="modal-content">
          <div className="setting-group">
            <label>包含路径 (正则表达式):</label>
            <input
              type="text"
              value={includePaths}
              onChange={(e) => setIncludePaths(e.target.value)}
              placeholder="例如: \.png$|\.jpg$"
            />
          </div>
          <div className="setting-group">
            <label>排除路径 (正则表达式):</label>
            <input
              type="text"
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              placeholder="例如: node_modules|\.git"
            />
          </div>
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showDetailedInfo}
                onChange={(e) => setShowDetailedInfo(e.target.checked)}
              />
              显示详细相似度信息
            </label>
          </div>
        </div>
        <div className="modal-actions">
          <button 
            style={{ backgroundColor: '#3182ce', color: 'white' }}
            onClick={() => {
              const settings = {
                searchPath,
                similarity,
                excludePaths,
                includePaths,
                showDetailedInfo,
              };
              localStorage.setItem('appSettings', JSON.stringify(settings));
              setShowSettings(false);
            }}
          >
            确认
          </button>
          <div style={{ margin: '0 5px' }} />
          <button 
            style={{ backgroundColor: '#f44336', color: 'white' }}
            onClick={() => setShowSettings(false)}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (previewUrl) {
      const img = new Image();
      img.onload = function() {
        const dimensions = document.getElementById('dimensions');
        if (dimensions) {
          dimensions.textContent = `${this.width} × ${this.height}`;
        }
      };
      img.src = previewUrl;
    }
  }, [previewUrl]);

  const handleSearch = () => {
    if (searchFile) {
      // 确保传入的是文件对象而不是事对象
      searchSimilarImages(searchFile);
    } else {
      setStatus('请先选择要搜索的图片文件');
    }
  };

  // 组件卸载清理定器
  useEffect(() => {
    return () => {
      if (similarityTimer) {
        clearTimeout(similarityTimer);
      }
    };
  }, [similarityTimer]);

  // 修改路径处理函数，确保跨平台兼容
  const getPathFromFile = (file) => {
    if (window.electron) {
      // Electron 环境 (Windows/Mac)
      return file.path;
    } else {
      // Web 环境
      return file.webkitRelativePath || file.name;
    }
  };

  const getDirectoryPath = (file) => {
    if (window.electron) {
      // Electron 环境
      if (process.platform === 'win32') {
        // Windows
        return file.path.substring(0, file.path.lastIndexOf('\\'));
      } else {
        // Mac/Linux
        return file.path.substring(0, file.path.lastIndexOf('/'));
      }
    } else {
      // Web 环境
      return file.webkitRelativePath.split('/')[0];
    }
  };

  const isImageFile = (file) => {
    const imageTypes = /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i;
    return file.type.startsWith('image/') || imageTypes.test(file.name);
  };

  const saveToStorage = (key, data) => {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Storage error:', error);
    }
  };

  const loadFromStorage = (key, defaultValue = null) => {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error('Storage error:', error);
      return defaultValue;
    }
  };

  const handleError = (error, operation) => {
    console.error(`Error during ${operation}:`, error);
    const message = window.electron 
      ? `操作失败: ${error.message}`
      : '操作失败，请检查浏览器控制台';
    setStatus(message);
  };

  const getPlatformInfo = () => {
    if (window.electron) {
      return {
        isElectron: true,
        platform: process.platform,
        isWindows: process.platform === 'win32',
        isMac: process.platform === 'darwin',
        isLinux: process.platform === 'linux'
      };
    }
    return {
      isElectron: false,
      platform: 'web',
      isWindows: false,
      isMac: false,
      isLinux: false
    };
  };

  const resultsHeader = (
    <div className="section-header">
      <div className="header-left">
        <FaImage /> Search Results
      </div>
      <div className="header-controls">
        <div className="control-item">
          <label>相似度:</label>
          <input
            type="range"
            min="0.0000"
            max="1.0000"
            step="0.0001"
            value={similarity}
            onChange={handleSimilarityChange}
          />
          <span>{Number(similarity).toFixed(4)}</span>
        </div>
        {availableDirs.length > 0 && (
          <div className="control-item">
            <label>目录:</label>
            <select
              value={resultDirFilter}
              onChange={(e) => setResultDirFilter(e.target.value)}
              className="directory-select"
            >
              <option value="">全部</option>
              {availableDirs.map(dir => (
                <option key={dir} value={dir}>{dir || '根目录'}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );

  const handleResultClick = async (index) => {
    setSelectedResult(index);
    const result = searchResults[index];
    
    try {
      if (window.electron) {
        // 获取最新的文件信息
        const stats = await window.electron.getFileSize(result.path);
        const dimensions = await window.electron.getImageDimensions(result.path);
                const similarityResult = await window.electron.calculateImageSimilarity(
          searchFile.path,
          result.path,
          { 
            colorWeight: 0.7,  // 使用固定权重
            shapeWeight: 0.3,  // 使用固定权重
            threshold: similarity 
          }
        );
        
        const normalizedColorWeight = 0.7 / (0.7 + 0.3);
        const normalizedShapeWeight = 0.3 / (0.7 + 0.3);
        
        const totalSimilarity = (
          similarityResult.colorSimilarity * normalizedColorWeight + 
          similarityResult.shapeSimilarity * normalizedShapeWeight
        );
        
        searchResults[index] = {
          ...result,
          size: stats,  // 使用时获取的文件大小
          dimensions: dimensions,  // 使用实时获取的图片尺寸
          colorSimilarity: similarityResult.colorSimilarity.toFixed(4),
          shapeSimilarity: similarityResult.shapeSimilarity.toFixed(4),
          totalSimilarity: totalSimilarity.toFixed(4),
          similarity: totalSimilarity.toFixed(4)
        };
        
        setSearchResults([...searchResults]);
      }
    } catch (error) {
      console.error('Error updating result details:', error);
    }
  };

  // 添加一个处理路径的辅助函数
  const getRelativePath = (fullPath) => {
    if (!searchPath || !fullPath) return fullPath;
    
    // 统一路径分隔符
    const normalizedFullPath = fullPath.replace(/\\/g, '/');
    const normalizedSearchPath = searchPath.replace(/\\/g, '/');
    
    // 如果路径以搜索目录开头，则去除该前缀
    if (normalizedFullPath.startsWith(normalizedSearchPath)) {
      let relativePath = normalizedFullPath.slice(normalizedSearchPath.length);
      // 去除开头的斜杠
      return relativePath.replace(/^[/\\]+/, '');
    }
    
    return fullPath;
  };

  // 添加一个存储处理的辅助函数
  const saveDirectoryStructure = (structure) => {
    try {
      // 创建一个简化版的结构，只保存必要的信息
      const simplifiedStructure = structure.map(item => ({
        name: item.name,
        path: item.path,
        type: item.type,
        size: item.size,
        dimensions: item.dimensions
      }));
      
      // 尝试分块存储
      const chunkSize = 50; // 每块存储50个项目
      const chunks = [];
      
      for (let i = 0; i < simplifiedStructure.length; i += chunkSize) {
        chunks.push(simplifiedStructure.slice(i, i + chunkSize));
      }
      
      // 清除旧的存储
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith('directoryStructure_chunk_')) {
          localStorage.removeItem(key);
        }
      }
      
      // 存储新的分块
      chunks.forEach((chunk, index) => {
        localStorage.setItem(`directoryStructure_chunk_${index}`, JSON.stringify(chunk));
      });
      
      // 存储分块数量
      localStorage.setItem('directoryStructure_chunks', chunks.length.toString());
      
      return true;
    } catch (error) {
      console.error('Error saving directory structure:', error);
      return false;
    }
  };

  // 添加一个加载处理的辅助函数
  const loadDirectoryStructure = () => {
    try {
      const chunks = parseInt(localStorage.getItem('directoryStructure_chunks') || '0');
      if (chunks === 0) return [];
      
      let structure = [];
      for (let i = 0; i < chunks; i++) {
        const chunk = localStorage.getItem(`directoryStructure_chunk_${i}`);
        if (chunk) {
          structure = structure.concat(JSON.parse(chunk));
        }
      }
      return structure;
    } catch (error) {
      console.error('Error loading directory structure:', error);
      return [];
    }
  };

  // 添加进度监听器
  useEffect(() => {
    const handleProgress = (event) => {
      const progress = event.detail;
      setCacheProgress(progress);
      
      // 根据进度类型更新状态
      switch (progress.type) {
        case 'start':
          setStatus(`准备处理 ${progress.total} 个文件...`);
          break;
        case 'progress':
          setStatus(`正在处理: ${progress.file} (${progress.current}/${progress.total})`);
          break;
        case 'error':
          console.error(`处理文件出错: ${progress.file}`, progress.error);
          break;
        case 'complete':
          setStatus(`缓存初始化完成，共处理 ${progress.total} 个文件`);
          setCacheProgress(null);
          setCacheInitialized(true);
          break;
      }
    };

    window.addEventListener('cache-init-progress', handleProgress);
    return () => window.removeEventListener('cache-init-progress', handleProgress);
  }, []);

  // 添加进度显示组件
  const progressOverlay = cacheProgress && !cacheInitialized && (
    <div className="progress-overlay">
      <div className="progress-content">
        <div className="progress-spinner"></div>
        <div className="progress-text">
          {cacheProgress.type === 'progress' && (
            <>
              <div className="progress-bar">
                <div 
                  className="progress-bar-fill" 
                  style={{width: `${(cacheProgress.current / cacheProgress.total * 100)}%`}}
                ></div>
              </div>
              <div>处理进度: {cacheProgress.current}/{cacheProgress.total}</div>
              <div>当前文件: {cacheProgress.file}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="App">
      <div className="container" style={{ display: 'flex' }}>
        <div className="main-content" style={{ flex: 1 }}>
          <div className="container">
            <div className="section directory-section">
              <div className="section-header">
                <div className="header-left">
                  <FaFolder /> Search Directory
                </div>
              </div>
              <div className="directory-input">
                <input 
                  type="text" 
                  value={searchPath}
                  onChange={(e) => {
                    setSearchPath(e.target.value);
                    if (!e.target.value.trim()) {
                      setDirectoryStructure([]);
                      localStorage.removeItem('directoryStructure');
                    }
                  }}
                  placeholder="Enter directory path to search"
                />
                <button className="browse-btn" onClick={handleBrowseDirectory}>Browse</button>
                <button onClick={handleSearch} disabled={!searchPath.trim()}>
                  <FaSearch /> Research
                </button>
                <button onClick={resetPreview} disabled={!searchPath.trim()}>
                  Reset
                </button>
                <button onClick={rebuildCache} disabled={!searchPath.trim()}>
                  Rebuild Cache
                </button>
                <button className="settings-btn" onClick={() => setShowSettings(true)}>
                  <FaCog /> Settings
                </button>
              </div>
            </div>

            <div className="section upload-section">
              <div className="upload-container">
                <div 
                  className={`upload-area ${!searchPath.trim() ? 'disabled' : ''}`}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (searchPath.trim()) {
                      handleDrop(e);
                    }
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (searchPath.trim()) {
                      handleDragOver(e);
                    }
                  }}
                >
                  <div className="upload-placeholder">
                    <FaUpload size={40} />
                    <p>{searchPath.trim() ? 'Drag and drop image here' : 'Please select a directory first'}</p>
                    <p>or</p>
                    <input
                      type="file"
                      accept="image/*,.jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
                      onChange={handleFileSelect}
                      id="file-input"
                      style={{display: 'none'}}
                      disabled={!searchPath.trim()}
                    />
                    <label 
                      htmlFor="file-input" 
                      className={`file-input-label ${!searchPath.trim() ? 'disabled' : ''}`}
                    >
                      Choose File
                    </label>
                  </div>
                </div>
                <div className="preview-area">
                  {previewUrl ? (
                    <div className="preview-content">
                      <img src={previewUrl} alt="Preview" className="preview-image" />
                      <div className="preview-info">
                        <p><span>Path:</span> {selectedFile?.path || selectedFile?.name}</p>
                        <p><span>Size:</span> {(selectedFile?.size / 1024).toFixed(2)} KB</p>
                        {selectedFile && (
                          <p><span>Dimensions:</span> <span id="dimensions">Loading...</span></p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="preview-placeholder">
                      <FaImage size={40} />
                      <p>Preview Area</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="section results-section">
              {resultsHeader}
              <div className="results-container">
                <div className="results-grid">
                  {searchResults.length > 0 ? (
                    searchResults
                      .filter(result => {
                        if (!resultDirFilter) return true;
                        const dir = getRelativePath(result.path).split('/').slice(0, -1).join('/');
                        return dir === resultDirFilter;
                      })
                      .map((result, index) => (
                        <div 
                          key={index}
                          className={`result-item ${selectedResult === index ? 'selected' : ''}`}
                          onClick={() => handleResultClick(index)}
                          onDoubleClick={() => handleDoubleClick(result.name)}
                        >
                          <div className="result-image">
                            <img src={result.preview} alt={result.name} />
                          </div>
                          <div className="result-info">
                            <div className="result-name" title={result.name}>{result.name}</div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="no-results">
                      <FaImage size={40} />
                      <p>No results found</p>
                      <p>Upload an image to start searching</p>
                    </div>
                  )}
                </div>
                <div className="result-preview">
                  {selectedResult !== null && searchResults[selectedResult] ? (
                    <div className="selected-result-details">
                      <div className='selected-result-details-div'>
                        <img 
                          src={searchResults[selectedResult].preview} 
                          alt={searchResults[selectedResult].name}
                        />
                      </div>
                      <div className="details">
                        <h3>文件详情</h3>
                        <p data-label="路径:">{getRelativePath(searchResults[selectedResult].path)}</p>
                        <p data-label="名称:">{searchResults[selectedResult].name}</p>
                        <p data-label="大小:">{searchResults[selectedResult].size}</p>
                        <p data-label="尺寸:">{searchResults[selectedResult].dimensions}</p>
                        <p data-label="总相似度:">{searchResults[selectedResult].similarity}</p>
                        {showDetailedInfo && (
                          <>
                            <p data-label="颜色相似度:">{searchResults[selectedResult].colorSimilarity}</p>
                            <p data-label="形状相似度:">{searchResults[selectedResult].shapeSimilarity}</p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="preview-placeholder">
                      <FaImage size={40} />
                      <p>Select an item to view details</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="section status-section">
              <div className="status-message" style={{ whiteSpace: 'pre-line' }}>
                {status || 'Ready to process'}
              </div>
            </div>
          </div>
        </div>
      </div>
      {progressOverlay}
      {settingsModal}
    </div>
  );
}

export default App;
