import React, { useState, useEffect, useRef, useCallback } from "react";
import channelsDataFromFile from "./data.json";

// --- Icons (simple SVG for example) ---
const PlayIcon = () => (
  <svg viewBox='0 0 24 24' width='48' height='48' fill='white'>
    <path d='M8 5v14l11-7z' />
  </svg>
);

const PauseIcon = () => (
  <svg viewBox='0 0 24 24' width='48' height='48' fill='white'>
    <path d='M6 19h4V5H6v14zm8-14v14h4V5h-4z' />
  </svg>
);

const FullscreenEnterIcon = () => (
  <svg viewBox='0 0 24 24' width='24' height='24' fill='white'>
    <path d='M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z' />
  </svg>
);

const FullscreenExitIcon = () => (
  <svg viewBox='0 0 24 24' width='24' height='24' fill='white'>
    <path d='M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z' />
  </svg>
);

// --- Data Structures & Constants (same as before) ---
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
const FADE_DURATION_MS = 300;
const PRELOAD_AHEAD_COUNT = 2;
const MAX_CONCURRENT_PRELOADS = 3;

const channelsData: Channel[] = channelsDataFromFile;

// --- Preloading Logic (same as before) ---
const preloadedVideoBlobs = new Map<string, string>();
const pendingPreloads = new Map<string, Promise<string>>();
const blobUrlEvictionQueue: string[] = [];
const preloadVideoAsBlob = async (videoSrc: string): Promise<string> => {
  /* ... same ... */
  if (preloadedVideoBlobs.has(videoSrc))
    return preloadedVideoBlobs.get(videoSrc)!;
  if (pendingPreloads.has(videoSrc)) return pendingPreloads.get(videoSrc)!;
  const promise = fetch(videoSrc)
    .then((response) =>
      response.ok
        ? response.blob()
        : Promise.reject(new Error(`Fetch failed: ${response.statusText}`))
    )
    .then((blob) => {
      const blobUrl = URL.createObjectURL(blob);
      if (blobUrlEvictionQueue.length >= MAX_CONCURRENT_PRELOADS) {
        const oldest = blobUrlEvictionQueue.shift();
        if (oldest) {
          URL.revokeObjectURL(preloadedVideoBlobs.get(oldest)!);
          preloadedVideoBlobs.delete(oldest);
        }
      }
      preloadedVideoBlobs.set(videoSrc, blobUrl);
      blobUrlEvictionQueue.push(videoSrc);
      return blobUrl;
    })
    .catch((error) => {
      console.error(`Preload error ${videoSrc}:`, error);
      return videoSrc;
    })
    .finally(() => {
      pendingPreloads.delete(videoSrc);
    });
  pendingPreloads.set(videoSrc, promise);
  return promise;
};
const formatTime = (timeInSeconds: number): string => {
  /* ... same ... */
  if (isNaN(timeInSeconds) || timeInSeconds === Infinity || timeInSeconds < 0)
    return "00:00";
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
  const [isMuted, setIsMuted] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // New state for play/pause and fullscreen
  const [isPlaying, setIsPlaying] = useState(true); // Assume autoplay initially
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControlsOverlay, setShowControlsOverlay] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoAreaRef = useRef<HTMLDivElement>(null); // For fullscreen target
  const transitionTimeoutRef = useRef<Timeout | null>(null);
  const overlayTimeoutRef = useRef<Timeout | null>(null);

  const currentChannel = channelsData[currentChannelIndex];
  const currentVideo = currentChannel?.videos[currentVideoIndex];

  const getVideoSource = useCallback((originalSrc: string): string => {
    return preloadedVideoBlobs.get(originalSrc) || originalSrc;
  }, []);

  // Effect for Preloading (same as before)
  useEffect(() => {
    /* ... same ... */
    if (!currentChannel) return;
    const videosToPreload: string[] = [];
    for (let i = 0; i < PRELOAD_AHEAD_COUNT; i++) {
      const nextVideoIdx =
        (currentVideoIndex + 1 + i) % currentChannel.videos.length;
      if (currentChannel.videos[nextVideoIdx])
        videosToPreload.push(currentChannel.videos[nextVideoIdx].src);
    }
    const nextChannelIndex = (currentChannelIndex + 1) % channelsData.length;
    if (channelsData[nextChannelIndex]?.videos[0])
      videosToPreload.push(channelsData[nextChannelIndex].videos[0].src);
    const prevChannelIndex =
      (currentChannelIndex - 1 + channelsData.length) % channelsData.length;
    if (channelsData[prevChannelIndex]?.videos[0])
      videosToPreload.push(channelsData[prevChannelIndex].videos[0].src);
    videosToPreload.forEach((src) => {
      if (!preloadedVideoBlobs.has(src) && !pendingPreloads.has(src))
        preloadVideoAsBlob(src).catch((e) =>
          console.warn("Preload failed for", src, e)
        );
    });
  }, [currentChannelIndex, currentVideoIndex, currentChannel]);

  // Effect for video source changes and transitions
  useEffect(() => {
    if (!currentVideo) {
      setShowPlaceholder(true);
      if (videoRef.current) videoRef.current.src = "";
      setCurrentTime(0);
      setDuration(0);
      setIsPlaying(false); // Ensure playing state is false
      return;
    }
    if (transitionTimeoutRef.current)
      clearTimeout(transitionTimeoutRef.current);
    setIsFading(true);
    setShowPlaceholder(true);
    setCurrentTime(0);
    setDuration(0);
    // setIsPlaying(true); // Autoplay will handle this via onPlay event

    transitionTimeoutRef.current = setTimeout(() => {
      const src = getVideoSource(currentVideo.src);
      setVideoSrcToPlay(src);
      setIsFading(false);
    }, FADE_DURATION_MS);
    return () => {
      if (transitionTimeoutRef.current)
        clearTimeout(transitionTimeoutRef.current);
    };
  }, [currentVideo, getVideoSource]);

  useEffect(() => {
    if (videoRef.current && videoSrcToPlay) {
      videoRef.current.src = videoSrcToPlay;
      // videoRef.current.load(); // src assignment usually triggers load
    }
  }, [videoSrcToPlay]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = isMuted;
  }, [isMuted, videoSrcToPlay]);

  const handleVideoEnded = useCallback(() => {
    setCurrentVideoIndex(
      (prevIndex) => (prevIndex + 1) % (currentChannel?.videos.length || 1)
    );
  }, [currentChannel]);

  const handleLoadedData = () => {
    if (videoRef.current) {
      // Autoplay is on the video tag. This ensures it plays if previously paused by user.
      // However, browser might block autoplay if not muted.
      // `isPlaying` state will be updated by `onPlay` event.
      if (videoRef.current.paused && !document.fullscreenElement) {
        // Only try to force play if not in an interrupted state
        videoRef.current
          .play()
          .catch((e) => console.warn("Play on load prevented:", e));
      }
      setShowPlaceholder(false);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // If unmuted and was paused, try to play (browser might still block)
      if (
        !isMuted &&
        videoRef.current.paused &&
        videoRef.current.readyState >= 3
      ) {
        // readyState 3 is HAVE_FUTURE_DATA
        videoRef.current
          .play()
          .catch((e) => console.warn("Play on metadata/unmute failed:", e));
      }
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
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
    setIsPlaying(false);
  };

  // Video Play/Pause events to sync state
  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Toggle Play/Pause
  const togglePlayPause = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current
        .play()
        .catch((e) => console.warn("Manual play failed:", e));
    } else {
      videoRef.current.pause();
    }
    // Briefly show overlay
    setShowControlsOverlay(true);
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(
      () => setShowControlsOverlay(false),
      1500
    );
  }, []);

  // Toggle Mute
  const toggleMute = () => {
    setIsMuted((prevMuted) => {
      const newMutedState = !prevMuted;
      if (videoRef.current) {
        videoRef.current.muted = newMutedState;
        if (
          !newMutedState &&
          videoRef.current.paused &&
          videoRef.current.readyState >= 3
        ) {
          videoRef.current
            .play()
            .catch((e) => console.warn("Manual play after unmute failed:", e));
        }
      }
      return newMutedState;
    });
  };

  // Fullscreen Logic
  const toggleFullscreen = useCallback(() => {
    if (!videoAreaRef.current) return;
    if (!document.fullscreenElement) {
      videoAreaRef.current.requestFullscreen().catch((err) => {
        alert(
          `Error attempting to enable full-screen mode: ${err.message} (${err.name})`
        );
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!currentChannel) return;

      // Allow space and 'f' if focus is not on an input/button (though we don't have many here)
      if (
        event.target &&
        ["INPUT", "BUTTON", "TEXTAREA"].includes(
          (event.target as HTMLElement).tagName
        )
      ) {
        if (event.key !== "Escape") return; // Allow Esc for fullscreen exit even from inputs
      }

      let newChannelIndex = currentChannelIndex;
      let newVideoIndex = currentVideoIndex;
      let shouldUpdateState = true;

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
        case " ": // Space bar
          event.preventDefault(); // Prevent page scroll
          togglePlayPause();
          shouldUpdateState = false; // Handled by togglePlayPause
          break;
        case "f":
        case "F":
          toggleFullscreen();
          shouldUpdateState = false; // Handled by toggleFullscreen
          break;
        default:
          shouldUpdateState = false;
          return; // Do nothing for other keys
      }

      if (shouldUpdateState) {
        setActiveKey(event.key); // Show arrow key active state
        if (newChannelIndex !== currentChannelIndex) {
          setCurrentChannelIndex(newChannelIndex);
          setCurrentVideoIndex(newVideoIndex);
        } else if (newVideoIndex !== currentVideoIndex) {
          setCurrentVideoIndex(newVideoIndex);
        }
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
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    };
  }, [
    currentChannelIndex,
    currentVideoIndex,
    currentChannel,
    togglePlayPause,
    toggleFullscreen,
  ]);

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (!currentChannel || !currentVideo) {
    return <div className='tv-app-loading'>Loading channels...</div>;
  }

  return (
    <div className='tv-app' ref={videoAreaRef}>
      {" "}
      {/* Fullscreen target */}
      <div
        className='video-area'
        onMouseEnter={() => setShowControlsOverlay(true)}
        onMouseLeave={() => {
          if (overlayTimeoutRef.current)
            clearTimeout(overlayTimeoutRef.current);
          overlayTimeoutRef.current = setTimeout(
            () => setShowControlsOverlay(false),
            500
          );
        }}
        onClick={togglePlayPause} // Click on video area toggles play/pause
      >
        <div className={`video-container ${isFading ? "fading" : ""}`}>
          {showPlaceholder && (
            <div className='video-placeholder'>Video Loading...</div>
          )}
          <video
            ref={videoRef}
            key={currentVideo.id + videoSrcToPlay}
            onEnded={handleVideoEnded}
            onLoadedData={handleLoadedData}
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onError={handleError}
            onPlay={handlePlay} // Sync isPlaying state
            onPause={handlePause} // Sync isPlaying state
            autoPlay
            playsInline
            // Muted state is controlled via useEffect and videoRef.current.muted
            style={{ opacity: showPlaceholder || isFading ? 0 : 1 }}
          />
          {!showPlaceholder && (showControlsOverlay || !isPlaying) && (
            <div className='video-overlay-controls'>
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </div>
          )}
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
        <div className='action-buttons'>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            className='control-button mute-button'
          >
            {isMuted ? "Unmute (M)" : "Mute (M)"}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFullscreen();
            }}
            className='control-button fullscreen-button'
          >
            {isFullscreen ? <FullscreenExitIcon /> : <FullscreenEnterIcon />}
            <span className='button-text'>
              {isFullscreen ? "Exit FS (F)" : "Fullscreen (F)"}
            </span>
          </button>
        </div>
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
        {/* Optional: Display Play/Pause status text for keyboard users */}
        {/* <div className="play-pause-status-text">
          {isPlaying ? 'Playing' : 'Paused'}
        </div> */}
      </div>
    </div>
  );
};

export default TVApp;
