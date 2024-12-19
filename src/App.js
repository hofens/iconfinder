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


  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedSettings = JSON.parse(localStorage.getItem('appSettings')) || {};
    setSearchPath(savedSettings.searchPath || '');
    setSimilarity(savedSettings.similarity || 0.9999);
    setExcludePaths(savedSettings.excludePaths || '');
    setIncludePaths(savedSettings.includePaths || '');

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
      searchSimilarImages();
    } else {
      setStatus('Error: Please upload an image file');
    }
  };

  const searchSimilarImages = () => {
    // 模拟搜索结果
    setSearchResults(Array(20).fill(null).map((_, index) => ({
      path: `/path/to/image${index + 1}.png`,
      name: `image${index + 1}.png`,
      size: '24KB',
      dimensions: '32x32',
      similarity: (1 - index * 0.02).toFixed(2),
      preview: 'https://via.placeholder.com/100'
    })));
    setStatus('Found 20 similar images');
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
    if (window.electron) {
      // Electron 环境
      window.electron.ipcRenderer.invoke('select-directory').then((directoryPath) => {
        setSearchPath(directoryPath);
        setStatus(`Selected directory: ${directoryPath}`);
      });
    } else {
      // Web 环境
      const input = document.createElement('input');
      input.type = 'file';
      input.webkitdirectory = true;
      input.onchange = (e) => {
        const files = Array.from(e.target.files);
        // 处理文件
      };
      input.click();
    }
  };

  const handleSimilarityChange = (e) => {
    const value = e.target.value;
    if (value >= 0.5 && value <= 0.9999) {
      setSimilarity(value);
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

  return (
    <div className="App">
      <div className="container">
        <div className="section directory-section">
          <div className="section-header">
            <FaFolder /> Search Directory
          </div>
          <div className="directory-input">
            <input 
              type="text" 
              value={searchPath}
              onChange={(e) => setSearchPath(e.target.value)}
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
                  <img src={previewUrl} alt="Preview" className="preview-image"/>
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
                onChange={(e) => setSimilarity(e.target.value)}
              />
              <span>{Number(similarity).toFixed(4)}</span>
            </div>
            <div className="buttons">
              <button onClick={searchSimilarImages}><FaSearch /> Search</button>
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
                  <img 
                    src={searchResults[selectedResult].preview} 
                    alt={searchResults[selectedResult].name}
                  />
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
          <div className="status-message">
            {status || 'Ready to process'}
          </div>
        </div>
      </div>
      {settingsModal}
    </div>
  );
}

export default App;
