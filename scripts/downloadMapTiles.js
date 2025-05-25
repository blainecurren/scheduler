// This script downloads map tiles for a specified region and zoom levels
const fs = require("fs");
const path = require("path");
const https = require("https");
const { promisify } = require("util");

// Use fs.promises for modern Node.js
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const access = promisify(fs.access);

// Configuration
const config = {
  // Define the bounding box for your service area (e.g., Austin, TX)
  bounds: {
    minLat: 30.1, // South
    maxLat: 30.5, // North
    minLng: -97.9, // West
    maxLng: -97.5, // East
  },
  // Define the zoom levels to download (8-14 is good for most use cases)
  minZoom: 8,
  maxZoom: 14,
  // Output directory (relative to project root)
  outputDir: "./public/tiles",
  // Tile server URL (OpenStreetMap default)
  tileUrl: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  // Subdomains for load balancing
  subdomains: ["a", "b", "c"],
};

// Helper function to check if file exists
async function fileExists(filePath) {
  try {
    await access(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

// Helper function to create directory if it doesn't exist
async function ensureDir(dirPath) {
  try {
    await mkdir(dirPath, { recursive: true });
  } catch (err) {
    // Ignore error if directory already exists
    if (err.code !== "EEXIST") throw err;
  }
}

// Helper function to download file
const downloadFile = (url, outputPath) => {
  return new Promise(async (resolve, reject) => {
    // Skip if file already exists
    if (await fileExists(outputPath)) {
      console.log(`Tile already exists: ${outputPath}`);
      return resolve();
    }

    // Ensure directory exists
    await ensureDir(path.dirname(outputPath));

    const file = fs.createWriteStream(outputPath);

    https
      .get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(
            new Error(
              `Failed to download ${url} - Status: ${response.statusCode}`
            )
          );
          file.close();
          fs.unlink(outputPath, () => {}); // Delete the file
          return;
        }

        response.pipe(file);

        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(outputPath, () => {}); // Delete the file if download fails
        reject(err);
      });
  });
};

// Convert lat, lng to tile coordinates
const getTileCoordinates = (lat, lng, zoom) => {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const y = Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)
      ) /
        Math.PI) /
      2) *
      n
  );
  return { x, y };
};

// Main function to download tiles
async function downloadTiles() {
  const { bounds, minZoom, maxZoom, outputDir, tileUrl, subdomains } = config;

  // Create output directory if it doesn't exist
  await ensureDir(outputDir);

  // List to track all tiles
  const allTiles = [];

  // Calculate tiles for each zoom level
  for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
    const nwTile = getTileCoordinates(bounds.maxLat, bounds.minLng, zoom);
    const seTile = getTileCoordinates(bounds.minLat, bounds.maxLng, zoom);

    for (let x = nwTile.x; x <= seTile.x; x++) {
      for (let y = nwTile.y; y <= seTile.y; y++) {
        allTiles.push({ zoom, x, y });
      }
    }
  }

  console.log(`Preparing to download ${allTiles.length} tiles...`);

  // Create a queue to download tiles with rate limiting
  const downloadQueue = async () => {
    let counter = 0;
    const total = allTiles.length;

    for (const tile of allTiles) {
      const { zoom, x, y } = tile;
      const subdomain = subdomains[counter % subdomains.length];
      const url = tileUrl
        .replace("{s}", subdomain)
        .replace("{z}", zoom)
        .replace("{x}", x)
        .replace("{y}", y);

      const outputPath = path.join(
        outputDir,
        String(zoom),
        String(x),
        `${y}.png`
      );

      try {
        await downloadFile(url, outputPath);
        counter++;

        // Report progress
        if (counter % 100 === 0 || counter === total) {
          console.log(
            `Downloaded ${counter}/${total} tiles (${Math.round(
              (counter / total) * 100
            )}%)`
          );
        }

        // Add a small delay to avoid overwhelming the server
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.error(
          `Error downloading tile ${zoom}/${x}/${y}: ${error.message}`
        );
      }
    }
  };

  // Start downloading
  console.log("Starting download...");
  await downloadQueue();
  console.log("Download complete!");

  // Create a fallback tile
  const fallbackPath = path.join(outputDir, "fallback.png");
  if (!(await fileExists(fallbackPath))) {
    // Create a simple gray tile as fallback
    console.log("Creating fallback tile...");
    const blankTileUrl = "https://a.tile.openstreetmap.org/0/0/0.png";
    await downloadFile(blankTileUrl, fallbackPath);
  }

  // Create a README file
  const readmePath = path.join(outputDir, "README.md");
  await writeFile(
    readmePath,
    `# Offline Map Tiles

This directory contains offline map tiles downloaded from OpenStreetMap for use in a HIPAA-compliant environment.

- Region: ${bounds.minLat},${bounds.minLng} to ${bounds.maxLat},${bounds.maxLng}
- Zoom levels: ${minZoom} to ${maxZoom}
- Total tiles: ${allTiles.length}
- Date downloaded: ${new Date().toISOString()}

These tiles are subject to the OpenStreetMap license terms: https://www.openstreetmap.org/copyright
`
  );

  console.log("Map tiles prepared successfully!");
  console.log(
    `Downloaded ${allTiles.length} tiles for zoom levels ${minZoom}-${maxZoom}`
  );
  console.log(`Files are located in: ${path.resolve(outputDir)}`);
}

// Run the script
downloadTiles().catch((err) => {
  console.error("Error downloading tiles:", err);
  process.exit(1);
});
