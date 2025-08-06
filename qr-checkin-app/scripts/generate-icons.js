const fs = require('fs');
const path = require('path');

// Create placeholder PNG icons for PWA
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

const createPlaceholderIcon = (size) => {
  // Create a simple base64 encoded PNG placeholder
  // This is a minimal 1x1 transparent PNG that we'll use as placeholder
  const transparentPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  
  // For a real implementation, you would use a library like sharp or canvas to generate proper icons
  // For now, we'll create placeholder files that indicate the required sizes
  const iconContent = `<!-- Placeholder icon ${size}x${size} -->
<svg width="${size}" height="${size}" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="64" fill="#3B82F6"/>
  <rect x="64" y="64" width="384" height="384" rx="32" fill="white"/>
  <rect x="96" y="96" width="96" height="96" fill="#3B82F6"/>
  <rect x="112" y="112" width="64" height="64" fill="white"/>
  <rect x="128" y="128" width="32" height="32" fill="#3B82F6"/>
  <rect x="320" y="96" width="96" height="96" fill="#3B82F6"/>
  <rect x="336" y="112" width="64" height="64" fill="white"/>
  <rect x="352" y="128" width="32" height="32" fill="#3B82F6"/>
  <rect x="96" y="320" width="96" height="96" fill="#3B82F6"/>
  <rect x="112" y="336" width="64" height="64" fill="white"/>
  <rect x="128" y="352" width="32" height="32" fill="#3B82F6"/>
  <path d="M320 280L360 320L420 240" stroke="#10B981" stroke-width="8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>`;
  
  return iconContent;
};

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate placeholder icons
sizes.forEach(size => {
  const iconPath = path.join(iconsDir, `icon-${size}x${size}.png`);
  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  
  // Create SVG version (which browsers can use)
  fs.writeFileSync(svgPath, createPlaceholderIcon(size));
  
  // Create a minimal PNG placeholder
  // In a real implementation, you'd convert SVG to PNG here
  const minimalPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(iconPath, minimalPng);
});

console.log('Generated placeholder icons for PWA');