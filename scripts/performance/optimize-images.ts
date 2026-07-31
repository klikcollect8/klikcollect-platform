/**
 * Image Optimization Script
 * This script identifies large images in the public directory and suggests optimizations.
 * In a real-world scenario, this would use sharp to resize and compress images.
 */
import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

function getFiles(dir: string): string[] {
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
}

function analyzeImages() {
  console.log('Analyzing images for performance optimization...');
  const files = getFiles(PUBLIC_DIR);
  const imageFiles = files.filter(file => /\.(jpg|jpeg|png|webp|svg)$/i.test(file));

  let totalSize = 0;
  const largeImages = [];

  for (const file of imageFiles) {
    const stats = fs.statSync(file);
    totalSize += stats.size;
    if (stats.size > 100 * 1024) { // > 100KB
      largeImages.push({
        name: path.relative(PUBLIC_DIR, file),
        size: (stats.size / 1024).toFixed(2) + ' KB'
      });
    }
  }

  console.log(`Found ${imageFiles.length} images.`);
  console.log(`Total image size: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);

  if (largeImages.length > 0) {
    console.log('\nSuggested Optimizations (Images > 100KB):');
    largeImages.forEach(img => {
      console.log(`- ${img.name}: ${img.size}`);
    });
  } else {
    console.log('\nAll images are well-optimized (< 100KB).');
  }
}

analyzeImages();
