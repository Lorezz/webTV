// scripts/generateChannelsData.ts

import * as fs from "fs";
import * as path from "path";

interface Video {
  id: string;
  src: string; // URL path relative to the public folder
  filename: string;
}

interface Channel {
  id: string;
  name: string;
  videos: Video[];
}

// --- Configuration ---
const publicFolderPath = path.resolve("../public"); // Assumes script is in 'scripts' folder, public is one level up
const videosBaseDir = "videos"; // The name of your main videos folder inside 'public'
const outputFilePath = path.resolve("../src/channelsData.json"); // Output path for the JSON

const allowedVideoExtensions = [".mp4", ".webm", ".ogv", ".mov"]; // Add more if needed

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function scanVideos(): Promise<Channel[]> {
  const channelsData: Channel[] = [];
  const videosRootPath = path.join(publicFolderPath, videosBaseDir);

  try {
    // Check if the main videos directory exists
    if (!fs.existsSync(videosRootPath)) {
      console.error(`Error: Videos directory not found at ${videosRootPath}`);
      throw new Error("Error: Videos directory not found");
    }

    const channelFolders = fs
      .readdirSync(videosRootPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const channelFolderName of channelFolders) {
      const channelId = generateId(channelFolderName);
      const channelPath = path.join(videosRootPath, channelFolderName);
      const videos: Video[] = [];

      const videoFiles = fs.readdirSync(channelPath).filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return allowedVideoExtensions.includes(ext);
      });

      videoFiles.sort(); // Optional: sort videos alphabetically by filename

      for (const videoFilename of videoFiles) {
        const videoId = generateId(
          path.basename(videoFilename, path.extname(videoFilename))
        );
        // The 'src' path should be relative to the public folder for web access
        const videoSrcPath = `/${videosBaseDir}/${channelFolderName}/${videoFilename}`;

        videos.push({
          id: `${channelId}-${videoId}`, // Make video ID unique across channels
          src: videoSrcPath,
          filename: videoFilename,
        });
      }

      if (videos.length > 0) {
        channelsData.push({
          id: channelId,
          name: channelFolderName, // Use folder name as channel name (can be customized)
          videos: videos,
        });
      } else {
        console.warn(
          `Channel folder '${channelFolderName}' has no valid video files. Skipping.`
        );
      }
    }
  } catch (error) {
    console.error("Error scanning video directories:", error);
    throw error;
  }

  return channelsData;
}

async function main() {
  console.log("Scanning video directories...");
  const channels = await scanVideos();

  if (channels.length === 0) {
    console.warn(
      "No channels or videos found. Output file will be empty or not created."
    );
  }

  try {
    fs.writeFileSync(outputFilePath, JSON.stringify(channels, null, 2));
    console.log(`Successfully generated channels data at: ${outputFilePath}`);
    console.log(`Found ${channels.length} channels.`);
    channels.forEach((channel) => {
      console.log(
        `  - Channel '${channel.name}' with ${channel.videos.length} videos.`
      );
    });
  } catch (error) {
    console.error("Error writing channels data to file:", error);
  }
}

main();
