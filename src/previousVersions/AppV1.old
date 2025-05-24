import React, { useState, useEffect, useRef, useCallback } from "react";

// --- Data Structures (same as before) ---
interface Video {
  id: string;
  src: string;
  filename: string;
}

interface Channel {
  id: string;
  name: string;
  videos: Video[];
}

// --- Constants (same as before, FADE_DURATION_MS might be used in CSS) ---
const FADE_DURATION_MS = 300;
const PRELOAD_AHEAD_COUNT = 2;
const MAX_CONCURRENT_PRELOADS = 3;

// --- Placeholder Data (same as before) ---
const channelsData: Channel[] = [
  {
    id: "channel1",
    name: "Nature Relaxation",
    videos: [
      {
        id: "vid1a",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
        filename: "BigBuckBunny.mp4",
      },
      {
        id: "vid1b",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
        filename: "ElephantsDream.mp4",
      },
      {
        id: "vid1c",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
        filename: "ForBiggerBlazes.mp4",
      },
    ],
  },
  {
    id: "channel2",
    name: "Short Films",
    videos: [
      {
        id: "vid2a",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
        filename: "ForBiggerEscapes.mp4",
      },
      {
        id: "vid2b",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
        filename: "ForBiggerFun.mp4",
      },
      {
        id: "vid2c",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4",
        filename: "ForBiggerJoyrides.mp4",
      },
    ],
  },
  {
    id: "channel3",
    name: "Tech Demos",
    videos: [
      {
        id: "vid3a",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
        filename: "Sintel.mp4",
      },
      {
        id: "vid3b",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4",
        filename: "SubaruOutback.mp4",
      },
      {
        id: "vid3c",
        src: "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4",
        filename: "TearsOfSteel.mp4",
      },
    ],
  },
];

// --- Preloading Logic (same as before) ---
const preloadedVideoBlobs = new Map<string, string>();
const pendingPreloads = new Map<string, Promise<string>>();
const blobUrlEvictionQueue: string[] = [];

const preloadVideoAsBlob = async (videoSrc: string): Promise<string> => {
  if (preloadedVideoBlobs.has(videoSrc)) {
    return preloadedVideoBlobs.get(videoSrc)!;
  }
  if (pendingPreloads.has(videoSrc)) {
    return pendingPreloads.get(videoSrc)!;
  }

  const promise = fetch(videoSrc)
    .then((response) => {
      if (!response.ok)
        throw new Error(`Failed to fetch ${videoSrc}: ${response.statusText}`);
      return response.blob();
    })
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      if (blobUrlEvictionQueue.length >= MAX_CONCURRENT_PRELOADS) {
        const oldestOriginalSrc = blobUrlEvictionQueue.shift();
        if (oldestOriginalSrc) {
          const blobToRevoke = preloadedVideoBlobs.get(oldestOriginalSrc);
          if (blobToRevoke) {
            URL.revokeObjectURL(blobToRevoke);
            preloadedVideoBlobs.delete(oldestOriginalSrc);
          }
        }
      }
      preloadedVideoBlobs.set(videoSrc, blobUrl);
      blobUrlEvictionQueue.push(videoSrc);
      return blobUrl;
    })
    .catch((error) => {
      console.error(`Error preloading video ${videoSrc}:`, error);
      return videoSrc;
    })
    .finally(() => {
      pendingPreloads.delete(videoSrc);
    });

  pendingPreloads.set(videoSrc, promise);
  return promise;
};

// --- Helper to format time (MM:SS) ---
const formatTime = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds) || timeInSeconds === Infinity || timeInSeconds < 0) {
    return "00:00";
  }
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
};

const TVApp: React.FC = () => {
  const [currentChannelIndex, setCurrentChannelIndex] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [videoSrcToPlay, setVideoSrcToPlay] = useState<string>("");
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // New state for audio and progress
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const currentChannel = channelsData[currentChannelIndex];
  const currentVideo = currentChannel?.videos[currentVideoIndex];

  const getVideoSource = useCallback((originalSrc: string): string => {
    return preloadedVideoBlobs.get(originalSrc) || originalSrc;
  }, []);

  // Effect for Preloading (same as before)
  useEffect(() => {
    if (!currentChannel) return;
    const videosToPreload: string[] = [];
    for (let i = 0; i < PRELOAD_AHEAD_COUNT; i++) {
      const nextVideoIdx =
        (currentVideoIndex + 1 + i) % currentChannel.videos.length;
      if (currentChannel.videos[nextVideoIdx]) {
        videosToPreload.push(currentChannel.videos[nextVideoIdx].src);
      }
    }
    const nextChannelIndex = (currentChannelIndex + 1) % channelsData.length;
    if (channelsData[nextChannelIndex]?.videos[0]) {
      videosToPreload.push(channelsData[nextChannelIndex].videos[0].src);
    }
    const prevChannelIndex =
      (currentChannelIndex - 1 + channelsData.length) % channelsData.length;
    if (channelsData[prevChannelIndex]?.videos[0]) {
      videosToPreload.push(channelsData[prevChannelIndex].videos[0].src);
    }
    videosToPreload.forEach((src) => {
      if (!preloadedVideoBlobs.has(src) && !pendingPreloads.has(src)) {
        preloadVideoAsBlob(src).catch((e) =>
          console.warn("Preload failed for", src, e)
        );
      }
    });
  }, [currentChannelIndex, currentVideoIndex, currentChannel]);

  // Effect for handling video source changes and transitions
  useEffect(() => {
    if (!currentVideo) {
      setShowPlaceholder(true);
      if (videoRef.current) videoRef.current.src = "";
      setCurrentTime(0); // Reset time/duration
      setDuration(0);
      return;
    }

    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    setIsFading(true);
    setShowPlaceholder(true);
    setCurrentTime(0); // Reset time for new video
    setDuration(0); // Reset duration for new video

    transitionTimeoutRef.current = setTimeout(() => {
      const src = getVideoSource(currentVideo.src);
      setVideoSrcToPlay(src);
      // Placeholder hidden onLoadedData or if video plays quickly
      setIsFading(false);
    }, FADE_DURATION_MS);

    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
    };
  }, [currentVideo, getVideoSource]);

  // Effect to set video src when videoSrcToPlay changes
  useEffect(() => {
    if (videoRef.current && videoSrcToPlay) {
      videoRef.current.src = videoSrcToPlay;
      // videoRef.current.load(); // src assignment usually triggers load
    }
  }, [videoSrcToPlay]);

  // Effect to control video's muted state from component state
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted, videoSrcToPlay]); // Rerun if video changes too

  const handleVideoEnded = useCallback(() => {
    setCurrentVideoIndex(
      (prevIndex) => (prevIndex + 1) % (currentChannel?.videos.length || 1)
    );
  }, [currentChannel]);

  const handleLoadedData = () => {
    if (videoRef.current) {
      videoRef.current
        .play()
        .catch((e) => console.warn("Play on load prevented:", e));
      setShowPlaceholder(false);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Attempt to play if it wasn't already (e.g. if autoplay was initially blocked and then unmuted)
      if (!isMuted && videoRef.current.paused) {
        videoRef.current
          .play()
          .catch((e) => console.warn("Play on metadata/unmute failed:", e));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      // Sometimes duration might become available later or more accurately
      if (
        duration !== videoRef.current.duration &&
        !isNaN(videoRef.current.duration)
      ) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error("Video Error:", e);
    setShowPlaceholder(true);
    // Optionally, advance to next video or show error message
    // handleVideoEnded();
  };

  // Keyboard navigation (same as before)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!currentChannel) return;
      setActiveKey(event.key);
      let newChannelIndex = currentChannelIndex;
      let newVideoIndex = currentVideoIndex;
      switch (event.key) {
        case "ArrowUp":
          newChannelIndex =
            (currentChannelIndex - 1 + channelsData.length) %
            channelsData.length;
          newVideoIndex = 0;
          break;
        case "ArrowDown":
          newChannelIndex = (currentChannelIndex + 1) % channelsData.length;
          newVideoIndex = 0;
          break;
        case "ArrowLeft":
          newVideoIndex =
            (currentVideoIndex - 1 + currentChannel.videos.length) %
            currentChannel.videos.length;
          break;
        case "ArrowRight":
          newVideoIndex =
            (currentVideoIndex + 1) % currentChannel.videos.length;
          break;
        default:
          return;
      }
      if (newChannelIndex !== currentChannelIndex) {
        setCurrentChannelIndex(newChannelIndex);
        setCurrentVideoIndex(newVideoIndex);
      } else if (newVideoIndex !== currentVideoIndex) {
        setCurrentVideoIndex(newVideoIndex);
      }
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
      ) {
        setActiveKey(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [currentChannelIndex, currentVideoIndex, currentChannel]);

  const toggleMute = () => {
    setIsMuted((prevMuted) => {
      const newMutedState = !prevMuted;
      if (videoRef.current) {
        videoRef.current.muted = newMutedState;
        // If unmuting and video was paused (possibly due to autoplay restrictions for unmuted content)
        if (!newMutedState && videoRef.current.paused) {
          videoRef.current
            .play()
            .catch((e) => console.warn("Manual play after unmute failed:", e));
        }
      }
      return newMutedState;
    });
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentChannel || !currentVideo) {
    return <div className='tv-app-loading'>Loading channels...</div>;
  }

  return (
    <div className='tv-app'>
      <div className='video-area'>
        <div className={`video-container ${isFading ? "fading" : ""}`}>
          {showPlaceholder && (
            <div className='video-placeholder'>Video Loading...</div>
          )}
          <video
            ref={videoRef}
            key={currentVideo.id + videoSrcToPlay} // Change key if src changes to ensure re-render/reset
            onEnded={handleVideoEnded}
            onLoadedData={handleLoadedData}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onError={handleError}
            autoPlay
            // muted={isMuted} // Controlled by useEffect now for more explicit control
            playsInline
            style={{ opacity: showPlaceholder || isFading ? 0 : 1 }}
          />
        </div>
      </div>

      <div className='video-playback-controls'>
        <div className='progress-bar-container'>
          <div
            className='progress-bar'
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <span className='time-display'>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
      </div>

      <div className='info-bar'>
        <div className='info-text'>
          <span className='channel-name'>Channel: {currentChannel.name}</span>
          <span className='video-name'>Video: {currentVideo.filename}</span>
        </div>
        <button onClick={toggleMute} className='mute-button'>
          {isMuted ? "Unmute (M)" : "Mute (M)"}
        </button>
      </div>

      <div className='controls-display'>
        <div
          className={`key-indicator ${activeKey === "ArrowUp" ? "active" : ""}`}
        >
          ▲
        </div>
        <div className='key-group-middle'>
          <div
            className={`key-indicator ${
              activeKey === "ArrowLeft" ? "active" : ""
            }`}
          >
            ◄
          </div>
          <div
            className={`key-indicator ${
              activeKey === "ArrowDown" ? "active" : ""
            }`}
          >
            ▼
          </div>
          <div
            className={`key-indicator ${
              activeKey === "ArrowRight" ? "active" : ""
            }`}
          >
            ►
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVApp;
