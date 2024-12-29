# Icon Finder
English | [简体中文](./README.md)

[![Vercel Deployment Status](https://therealsujitk-vercel-badge.vercel.app/?app=iconfinder)](https://iconfinder.vercel.app)

🌐 Online Access: [https://iconfinder.vercel.app](https://iconfinder.vercel.app)

An intelligent icon/image search tool based on image similarity, supporting shape and color matching to help you quickly find similar images among large collections.
![Screenshot](./screenshots/screenshot.png)

## Main Features

### 1. Image Search
- Support drag and drop or file selection for searching
- Similarity calculation based on color and shape
- Real-time preview of search results
- Adjustable similarity threshold for result filtering
- Directory-based result filtering
- Support for major image formats: JPG, JPEG, PNG, GIF, BMP, WebP, SVG

### 2. Directory Management
- Browse and select directories for searching
- Automatic scanning of all image files in directories
- Support for include/exclude path filtering with regular expressions
- Cache directory structure for improved subsequent search speed

### 3. Image Caching
- Automatic caching of image features for faster searching
- Support for cache rebuilding
- Display of cache building progress
- Intelligent cache status detection to avoid redundant processing

### 4. Result Display
- Grid-style display of search results
- Show image preview, filename, and similarity
- Support for viewing detailed image information (dimensions, size, etc.)
- Optional display of color and shape similarity details
- Support for enlarged image preview

### 5. Additional Features
- Chinese and English interface language support
- Automatic saving of user settings and preferences
- Support for dark/light theme (follows system)
- File drag and drop operation support
- Double-click to copy filename functionality

## Usage Guide

1. Select Directory
   - Click "Browse" button to select an image directory
   - First-time directory selection will automatically build image feature cache
   - Configure directory filtering rules in settings

2. Search Images
   - Drag image to upload area or click "Select File"
   - Wait for search completion, results will be displayed sorted by similarity
   - Use similarity slider to adjust matching precision
   - Use directory dropdown to filter results from specific directories

3. View Results
   - Click image to view detailed information
   - Enable "Show Detailed Similarity Information" in settings for more details
   - Click preview image to enlarge
   - Double-click filename to copy

4. Settings Options
   - Language Switch: Support for Chinese and English interface
   - Include Paths: Set rules for included file paths
   - Exclude Paths: Set rules for excluded file paths
   - Detailed Information: Enable/disable detailed similarity information display

## Technical Features
- Efficient image processing using Sharp library
- Implementation of similarity calculation based on color histogram and shape features
- Multi-level caching strategy for performance improvement
- Efficient searching for large-scale image libraries
- Front-end and back-end separation using Electron IPC communication
- Algorithm details available in [README_ALGORITHM.md](./README_ALGORITHM.md)

## Installation and Running

### Development Environment
```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for specific platforms
npm run build:mac    # macOS
npm run build:win    # Windows
``` 

## Contributing

Pull Requests and Issues are welcome.

## License

[MIT License](./LICENSE) 