# IconFinder

[简体中文](./README.md) | English

A similarity-based icon finder that helps you quickly locate similar or duplicate icons in your project.

![Screenshot](./screenshots/screenshot.png)

## Features

- 🔍 Image Search: Find similar images in your project by uploading a reference image
- 🎯 Similarity Control: Precise similarity threshold setting from 0.5000 to 0.9999
- 📁 Directory Management: Configure search and exclude directories
- 🖼️ Image Preview: Preview original and search result images
- 💾 Image Cache: Automatic cache building and updating for faster searches
- 🔄 Real-time Feedback: Display search and operation status
- 📋 Quick Copy: Double-click to copy file names

## Getting Started

### Prerequisites

- Node.js >= 14.0.0
- npm >= 6.14.0

### Installation

```bash
# Clone the repository
git clone https://github.com/hofens/iconfinder.git

# Enter the project directory
cd iconfinder

# Install dependencies
npm install
```

### Development

```bash
# Start the development server
npm start
```

### Build

```bash
# Build the production version
npm run build
```

## Usage

1. Select the search directory: Click the "Browse" button to select the directory to search
2. Upload the image: Drag and drop the image or click to select a file
3. Adjust the similarity: Use the slider to set the desired similarity threshold
4. View the results: Check the similar images in the result list
5. Preview details: Click on a result item to view details
6. Copy file names: Double-click on a result item to copy the file name

## Configuration

### Search Settings

Click the "Settings" button to configure:

- Include paths: Use regular expressions to set the paths to include
- Exclude paths: Use regular expressions to set the paths to exclude

## Contribution

Welcome to submit Pull Requests or create Issues.

## Open Source License

[MIT License](./LICENSE) 