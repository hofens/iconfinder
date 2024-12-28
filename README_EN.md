# Icon Finder

An intelligent icon/image search tool based on image similarity, supporting smart matching of shape, color, and rounded corner features.

## Key Features

### 1. Intelligent Search
- Color similarity matching
- Shape similarity matching (including size, aspect ratio, orientation)
- Rounded corner feature detection
- Adjustable similarity threshold for precise result control

### 2. File Support
- Supports major image formats: JPG, JPEG, PNG, GIF, BMP, WebP, SVG
- Drag and drop upload
- File preview support

### 3. Directory Management
- Search directory selection
- Directory filter display
- Include/Exclude directory rules (using regular expressions)
- Cross-platform path handling

### 4. Caching Mechanism
- Automatic image feature caching
- Persistent storage support
- Cache rebuilding support
- Search performance optimization

### 5. Search Results
- Real-time preview
- Detailed file information display
- Detailed similarity information display (color similarity, shape similarity)
- Directory-based result filtering
- Double-click to copy filename

## Usage

### Basic Operations
1. Click "Browse" to select the search directory
2. Drag and drop or select the target image
3. Adjust similarity threshold (0-1) to control matching precision
4. View search results, click for detailed preview

### Advanced Settings
Click "Settings" for advanced configuration:
- Include Paths: Use regex to specify paths to include, e.g., `\.png$|\.jpg$`
- Exclude Paths: Use regex to specify paths to exclude, e.g., `thumbnails|temp`
- Detailed Info: Enable to view detailed similarity data

### Cache Management
- Cache is automatically built on first directory scan
- Click "Rebuild Cache" to rebuild directory cache
- Cache file is stored as `.image-cache.json` in the directory

### Result Filtering
- Use directory dropdown to filter results by directory
- Adjust similarity threshold for real-time result filtering
- Reset button to clear current search state

## Technical Features
- Efficient image processing using Sharp
- SIMD optimization support
- Cross-platform support (Windows, macOS, Linux)
- Built with Electron + React

## Installation and Running

### Development Environment
```bash
# Install dependencies
npm install

# Start development server
npm start
```

### Production Environment
```bash
# Build application
npm run build

# Package application
npm run build:electron

# Platform-specific packaging
npm run build:mac    # macOS
npm run build:win    # Windows
```

## System Requirements
- Node.js 14.0 or higher
- Windows 10/11, macOS 10.13+, or Linux
- 2GB+ available memory
- 500MB+ available disk space 