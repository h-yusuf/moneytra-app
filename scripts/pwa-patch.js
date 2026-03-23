/**
 * PWA Patch Script
 * Injects Apple PWA meta tags and manifest link into Expo's generated dist/index.html
 * Run after: npx expo export --platform web
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'dist');
const htmlFile = path.join(distDir, 'index.html');

// PWA tags to inject into <head>
const PWA_TAGS = `
<meta name="theme-color" content="#c8f542"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="Monetra"/>
<link rel="manifest" href="/manifest.json?v=2"/>
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png?v=2"/>
<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png?v=2"/>
<meta name="description" content="Track your expenses, savings, and financial goals with Monetra."/>
<meta name="application-name" content="Monetra"/>
`;

if (!fs.existsSync(htmlFile)) {
  console.error('[pwa-patch] Error: dist/index.html not found. Run expo export first.');
  process.exit(1);
}

let html = fs.readFileSync(htmlFile, 'utf-8');

// Check if already patched
if (html.includes('apple-mobile-web-app-capable')) {
  console.log('[pwa-patch] Already patched, skipping.');
  process.exit(0);
}

// Inject after <head>
html = html.replace('<head>', '<head>' + PWA_TAGS);

fs.writeFileSync(htmlFile, html, 'utf-8');
console.log('[pwa-patch] ✅ PWA meta tags injected into dist/index.html');

// Also copy assets
const copyFile = (src, dest) => {
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`[pwa-patch] Copied: ${path.relative(process.cwd(), dest)}`);
  }
};

const root = path.join(__dirname, '..');
copyFile(path.join(root, 'public/icons/icon-192.png'), path.join(distDir, 'icons/icon-192.png'));
copyFile(path.join(root, 'public/icons/icon-512.png'), path.join(distDir, 'icons/icon-512.png'));
copyFile(path.join(root, 'public/icons/icon-512-maskable.png'), path.join(distDir, 'icons/icon-512-maskable.png'));
copyFile(path.join(root, 'public/icons/apple-touch-icon.png'), path.join(distDir, 'icons/apple-touch-icon.png'));
copyFile(path.join(root, 'web/sw.js'), path.join(distDir, 'sw.js'));
copyFile(path.join(root, 'web/manifest.json'), path.join(distDir, 'manifest.json'));

console.log('[pwa-patch] ✅ All PWA assets copied to dist/');
