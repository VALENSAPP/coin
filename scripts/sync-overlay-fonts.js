/**
 * Copies Google Font .ttf files from @expo-google-fonts packages into src/assets/fonts
 * so React Native can link them natively (no expo-font / expo-modules-core).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'assets', 'fonts');

const FONT_SOURCES = [
  ['@expo-google-fonts/alfa-slab-one', '400Regular/AlfaSlabOne_400Regular.ttf'],
  ['@expo-google-fonts/caveat', '400Regular/Caveat_400Regular.ttf'],
  ['@expo-google-fonts/dancing-script', '400Regular/DancingScript_400Regular.ttf'],
  ['@expo-google-fonts/open-sans', '400Regular/OpenSans_400Regular.ttf'],
  ['@expo-google-fonts/pacifico', '400Regular/Pacifico_400Regular.ttf'],
  ['@expo-google-fonts/playwrite-au-qld', '400Regular/PlaywriteAUQLD_400Regular.ttf'],
  ['@expo-google-fonts/playwrite-hu', '400Regular/PlaywriteHU_400Regular.ttf'],
  ['@expo-google-fonts/playwrite-pl', '400Regular/PlaywritePL_400Regular.ttf'],
  ['@expo-google-fonts/roboto', '400Regular/Roboto_400Regular.ttf'],
  ['@expo-google-fonts/roboto-mono', '400Regular/RobotoMono_400Regular.ttf'],
  ['@expo-google-fonts/triodion', '400Regular/Triodion_400Regular.ttf'],
];

fs.mkdirSync(OUT_DIR, { recursive: true });

for (const [pkg, relPath] of FONT_SOURCES) {
  const src = path.join(ROOT, 'node_modules', pkg, relPath);
  const fileName = path.basename(relPath);
  const dest = path.join(OUT_DIR, fileName);

  if (!fs.existsSync(src)) {
    console.warn(`[sync-overlay-fonts] missing: ${src}`);
    continue;
  }

  fs.copyFileSync(src, dest);
  console.log(`[sync-overlay-fonts] ${fileName}`);
}
