import React, { useState, useEffect } from 'react';
import './App.css';
import { FaUpload, FaFolder, FaImage, FaSearch, FaCog } from 'react-icons/fa';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [similarity, setSimilarity] = useState(0.9999);
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

  // Ensure ipcRenderer is available

  
  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('appSettings')) || {};
    setSearchPath(savedSettings.searchPath || '');
    setSimilarity(savedSettings.similarity || 0.9999);
    setExcludePaths(savedSettings.excludePaths || '');
    setIncludePaths(savedSettings.includePaths || '');
    // 加载保存的目录结构
    const savedStructure = JSON.parse(localStorage.getItem('directoryStructure')) || [];
    setDirectoryStructure(savedStructure);
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    const settings = {
      searchPath,
      similarity,
      excludePaths,
      includePaths,
    };
    localStorage.setItem('appSettings', JSON.stringify(settings));
  }, [searchPath, similarity, excludePaths, includePaths]);

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
    // 先重置之前的状态
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
      setSearchFile(file);
      searchSimilarImages(file);
    } else {
      setStatus('Error: Please upload an image file');
      setSelectedFile(null);
      setSearchFile(null);
    }
  };

  async function searchSimilarImages(file) {
    if (!file || typeof file === 'object' && !file.name) {
      setStatus('无效的文件');
      return;
    }

    let results = [];
    const filePath = window.electron ? file.path : (file.webkitRelativePath || file.name);
    
    results = directoryStructure.filter(fileEntry => {
      // 确保只搜索图片文件
      const isImage = fileEntry.type.startsWith('image/') || 
                     /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(fileEntry.name);
      
      if (!isImage) return false;

      if (window.electron) {
        // Electron 环境下使用完整路径匹配
        return fileEntry.path.toLowerCase().includes(file.name.toLowerCase());
      } else {
        // Web 环境下使用文件名匹配
        return fileEntry.name.toLowerCase().includes(file.name.toLowerCase());
      }
    });
    
    try {
      const updatedResults = await Promise.all(results.map(async (fileEntry) => {
        try {
          const size = await getFileSize(fileEntry.path);
          const dimensions = await getImageDimensions(fileEntry.path);
          const preview = await getImagePreview(file);
          return {
            path: fileEntry.path,
            name: fileEntry.name,
            size: size,
            dimensions: dimensions,
            similarity: calculateSimilarity(fileEntry.name, file.name),
            preview: preview
          };
        } catch (error) {
          console.error('Error processing file:', fileEntry.name, error);
          return null;
        }
      }));

      // 过滤掉处理失败的结果
      const validResults = updatedResults.filter(result => result !== null);
      setSearchResults(validResults);
      setStatus(`找到 ${validResults.length} 个相似图片`);
    } catch (error) {
      console.error('Search error:', error);
      setStatus('搜索过程中发生错误');
    }
  }

  // Update getFileSize to use ipcRenderer
  const getFileSize = async (filePath) => {
    if (window.electron) {
      try {
        const size = await window.electron.getFileSize(filePath);
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
        return await window.electron.getImageDimensions(filePath);
      } catch (error) {
        console.error('Error getting dimensions:', error);
        return 'Unknown dimensions';
      }
    } else {
      try {
        const file = directoryStructure.find(f => f.path === filePath);
        if (!file) return 'Unknown dimensions';
        
        return new Promise((resolve) => {
          const img = new Image();
          img.onload = () => {
            resolve(`${img.naturalWidth}x${img.naturalHeight}`);
          };
          img.onerror = () => {
            resolve('Unknown dimensions');
          };
          img.src = URL.createObjectURL(file);
        });
      } catch (error) {
        return 'Unknown dimensions';
      }
    }
  };

  // 辅助函数：计算相似度
  const calculateSimilarity = (fileName1, fileName2) => {
    // 这里可以实现相似度计算的逻辑
    // 例如，简单的字符串比较或更复杂的算法
    return (fileName1 === fileName2) ? '1.00' : '0.90'; // 示例返回值
  };

  // 辅助函数：获取图片预览
  const getImagePreview = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
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
  };

  const rebuildCache = () => {
    setStatus('Rebuilding cache...');
    // TODO: 实现缓存重建逻辑
  };

  const handleDoubleClick = (fileName) => {
    navigator.clipboard.writeText(fileName).then(() => {
      setStatus(`Copied: ${fileName}`);
      setTimeout(() => setStatus(''), 2000);
    });
  };

  const handleBrowseDirectory = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.webkitdirectory = true;
    input.multiple = true;

    input.onchange = (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        // 过滤出图片文件
        const imageFiles = files.filter(file => 
          file.type.startsWith('image/') || 
          /\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i.test(file.name)
        );
        
        // 根据环境保存不同的文件信息
        const structure = files.map(file => ({
          name: file.name,
          path: window.electron ? file.path : (file.webkitRelativePath || file.name),
          size: file.size,
          type: file.type
        }));
        setDirectoryStructure(structure);
        
        // 获取选择的目录路径
        const firstFile = files[0];
        let directoryPath;
        
        if (window.electron) {
          directoryPath = firstFile.path.substring(0, firstFile.path.lastIndexOf(firstFile.name));
        } else {
          directoryPath = firstFile.webkitRelativePath.split('/')[0];
        }
        
        // 更新搜索路径
        console.log('Selected directory:', directoryPath);
        setSearchPath(directoryPath);
        
        // 保存目录结构到 localStorage
        localStorage.setItem('directoryStructure', JSON.stringify(structure));
        
        setStatus(
          `已选择目录: ${directoryPath}\n` +
          `共发现 ${files.length} 个文件，其中含 ${imageFiles.length} 个图片文件`
        );
      } else {
        setStatus('未选择任何目录');
        setSearchPath('');
        setDirectoryStructure([]);
        localStorage.removeItem('directoryStructure');
      }
    };

    input.click();
  };

  const handleSimilarityChange = (e) => {
    const value = e.target.value;
    if (value >= 0.5 && value <= 0.9999) {
      setSimilarity(value);
      setStatus(`调整相似度为: ${Number(value).toFixed(4)}`);
      
      // 清除之前的定时器
      if (similarityTimer) {
        clearTimeout(similarityTimer);
      }
      
      // 设置新的定时器
      const timer = setTimeout(() => {
        if (searchFile) {
          setStatus('开始搜索...');
          searchSimilarImages(searchFile);
        }
      }, 500); // 500ms 后触发搜索
      
      setSimilarityTimer(timer);
    }
  };

  const settingsModal = showSettings && (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Search Settings</h2>
        <div className="modal-content">
          <div className="setting-group">
            <label>Include Paths (Regular Expression):</label>
            <input
              type="text"
              value={includePaths}
              onChange={(e) => setIncludePaths(e.target.value)}
              placeholder="e.g., \.png$|\.jpg$"
            />
          </div>
          <div className="setting-group">
            <label>Exclude Paths (Regular Expression):</label>
            <input
              type="text"
              value={excludePaths}
              onChange={(e) => setExcludePaths(e.target.value)}
              placeholder="e.g., node_modules|\.git"
            />
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
              };
              localStorage.setItem('appSettings', JSON.stringify(settings));
              setShowSettings(false);
            }}
          >
            Confirm
          </button>
          <div style={{ margin: '0 5px' }} />
          <button 
            style={{ backgroundColor: '#f44336', color: 'white' }}
            onClick={() => setShowSettings(false)}
          >
            Cancel
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
      // 确保传入的是文件对象而不是事件对象
      searchSimilarImages(searchFile);
    } else {
      setStatus('请先选择要搜索的图片文件');
    }
  };

  // 组件卸载时清理定时器
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

  return (
    <div className="App">
      <div className="container" style={{ display: 'flex' }}>
        <div className="main-content" style={{ flex: 1 }}>
          <div className="container">
            <div className="section directory-section">
              <div className="section-header">
                <FaFolder /> Search Directory
              </div>
              <div className="directory-input">
                <input 
                  type="text" 
                  value={searchPath}
                  onChange={(e) => {
                    setSearchPath(e.target.value);
                    // 当输入框被清空时，清除目录结构
                    if (!e.target.value.trim()) {
                      setDirectoryStructure([]);
                      localStorage.removeItem('directoryStructure');
                    }
                  }}
                  placeholder="Enter directory path to search"
                />
                <button className="browse-btn" onClick={handleBrowseDirectory}>Browse</button>
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
                      accept="image/*"
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
              
              <div className="controls">
                <div className="similarity-control">
                  <label>Similarity:</label>
                  <input
                    type="range"
                    min="0.5"
                    max="0.9999"
                    step="0.0001"
                    value={similarity}
                    onChange={handleSimilarityChange}
                  />
                  <span>{Number(similarity).toFixed(4)}</span>
                </div>
                <div className="buttons">
                  <button 
                    onClick={handleSearch}
                    disabled={!searchPath.trim()}
                  >
                    <FaSearch /> Search
                  </button>
                  <button 
                    onClick={resetPreview}
                    disabled={!searchPath.trim()}
                  >
                    Reset
                  </button>
                  <button 
                    onClick={rebuildCache}
                    disabled={!searchPath.trim()}
                  >
                    Rebuild Cache
                  </button>
                </div>
              </div>
            </div>

            <div className="section results-section">
              <div className="section-header">
                <FaImage /> Search Results
              </div>
              <div className="results-container">
                <div className="results-grid">
                  {searchResults.length > 0 ? (
                    searchResults.map((result, index) => (
                      <div 
                        key={index}
                        className={`result-item ${selectedResult === index ? 'selected' : ''}`}
                        onClick={() => setSelectedResult(index)}
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
                        <h3>File Details</h3>
                        <p data-label="Path:">{searchResults[selectedResult].path}</p>
                        <p data-label="Name:">{searchResults[selectedResult].name}</p>
                        <p data-label="Size:">{searchResults[selectedResult].size}</p>
                        <p data-label="Dimensions:">{searchResults[selectedResult].dimensions}</p>
                        <p data-label="Similarity:">{searchResults[selectedResult].similarity}</p>
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
      {settingsModal}
    </div>
  );
}

export default App;
