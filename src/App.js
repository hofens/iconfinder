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
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
      setStatus('Searching for similar images...');
      setSearchFile(file);
      searchSimilarImages(file);
    } else {
      setStatus('Error: Please upload an image file');
    }
  };

  async function searchSimilarImages(file) {
    let results = [];
    const filePath = file.path || file.name; // Use file path or name as needed
    if (window.electron) {
      results = directoryStructure.filter(fileEntry => {
        return fileEntry.path.includes(filePath);
      });
    } else {
      results = directoryStructure.filter(fileEntry => 
        fileEntry.name.includes(filePath)
      );
    }
    
    // Resolve all promises before setting the search results
    const updatedResults = await Promise.all(results.map(async (fileEntry) => {
      const size = await getFileSize(fileEntry.path);
      const dimensions = await getImageDimensions(fileEntry.path);
      const preview = await getImagePreview(file); // Pass the File object here
      return {
        path: fileEntry.path,
        name: fileEntry.name,
        size: size,
        dimensions: dimensions,
        similarity: calculateSimilarity(fileEntry.name, filePath),
        preview: preview
      };
    }));

    setSearchResults(updatedResults);
    setStatus(`Found ${updatedResults.length} similar images`);
  }

  // Update getFileSize to use ipcRenderer
  const getFileSize = async (filePath) => {
    console.log(`Attempting to get file size for ${filePath}`);
    const size = await window.electron.getFileSize(filePath);
    console.log(`File size for ${filePath}: ${size}`);
    return size; // Return the size received from the main process
  };

  // 辅助函数：获取图片尺寸
  const getImageDimensions = async (filePath) => {
    console.log(`Attempting to get image dimensions for ${filePath}`);
    if (window.electron) {
      // Use ipcRenderer to request image dimensions from the main process
      const dimensions = await window.electron.getImageDimensions(filePath);
      console.log(`Image dimensions for ${filePath}: ${dimensions}`);
      return dimensions;
    } else {
      // For non-electron environments, use the traditional approach
      const img = new Image();
      img.src = filePath; // 使用文件路径加载图片
      await new Promise((resolve, reject) => {
        img.onload = () => {
          const dimensions = `${img.naturalWidth}x${img.naturalHeight}`; // 返回实际尺寸
          console.log(`Image dimensions for ${filePath}: ${dimensions}`);
          resolve(dimensions);
        };
        img.onerror = (error) => {
          console.error(`Error loading image for dimensions: ${error}`);
          reject(error);
        };
      });
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
    // 不清除 searchPath 和 directoryStructure
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
        
        const structure = files.map(file => ({
          name: file.name,
          path: file.path
        }));
        setDirectoryStructure(structure);
        
        // 获取选择的目录路径
        const firstFile = files[0];
        const directoryPath = firstFile.path.substring(0, firstFile.path.lastIndexOf(firstFile.name));
        
        // 更新搜索路径
        console.log('Selected directory:', directoryPath);
        setSearchPath(directoryPath);
        
        // 保存目录结构到 localStorage
        localStorage.setItem('directoryStructure', JSON.stringify(structure));
        
        // 显示详细的状态信息
        setStatus(
          `已选择目录: ${directoryPath}\n` +
          `共发现 ${files.length} 个文件，其中包含 ${imageFiles.length} 个图片文件`
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
      searchSimilarImages(searchFile);
    } else {
      setStatus('请先选择要搜索的���片文件');
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
                  className="upload-area"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="upload-placeholder">
                    <FaUpload size={40} />
                    <p>Drag and drop image here</p>
                    <p>or</p>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      id="file-input"
                      style={{display: 'none'}}
                    />
                    <label htmlFor="file-input" className="file-input-label">
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
                  <button onClick={handleSearch}><FaSearch /> Search</button>
                  <button onClick={resetPreview}>Reset</button>
                  <button onClick={rebuildCache}>Rebuild Cache</button>
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
