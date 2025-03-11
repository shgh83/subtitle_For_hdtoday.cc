const videoStates = new Map();

// Storage key for SRT path in chrome.storage.local (added for consistency)
const SRT_STORAGE_KEY = 'userSrtPath';

function createSubtitleElement(video) {
  let state = videoStates.get(video);
  if (!state) {
    state = {
      subtitleElement: document.createElement('div'),
      infoElement: document.createElement('div'), // Added for potential debug info
      subtitles: [],
      updateInterval: null,
      type: video.tagName ? 'HTML5' : 'JWPlayer',
      parentContainer: null,
      settings: {} // Added to support settings
    };
    state.subtitleElement.className = 'video-subtitle';
    state.subtitleElement.style.cssText = `
      position: absolute;
      pointer-events: none;
      z-index: 2147483647;
      padding: 5px 10px;
      text-shadow: 1px 1px 2px black;
    `;

    state.infoElement.className = 'video-info';
    state.infoElement.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      z-index: 2147483647;
      font-family: Arial, sans-serif;
      font-size: 14px;
      display: none;
    `;

    // Check for JW Player container
    const jwButtonContainer = video.parentElement?.querySelector('.jw-reset.jw-button-container');
    if (jwButtonContainer) {
      state.type = 'JWPlayer';
      state.parentContainer = jwButtonContainer.parentElement;
      state.parentContainer.insertBefore(state.subtitleElement, jwButtonContainer);
      state.parentContainer.appendChild(state.infoElement); // Add info element
    } else {
      state.parentContainer = video.parentElement?.querySelector('[pseudo="-webkit-media-controls"]') || video.parentElement || document.body;
      state.parentContainer.appendChild(state.subtitleElement);
      state.parentContainer.appendChild(state.infoElement); // Add info element
    }

    videoStates.set(video, state);
  }
  return state;
}

function positionSubtitle(video) {
  const state = videoStates.get(video);
  if (!state || !state.subtitleElement) return;

  const isFullscreen = document.fullscreenElement === video ||
                      video.webkitDisplayingFullscreen ||
                      document.webkitFullscreenElement === video ||
                      document.fullscreenElement?.contains(video);
  let container = state.parentContainer;

  if (state.type === 'HTML5') {
    if (isFullscreen) {
      container = document.fullscreenElement || video;
      if (state.subtitleElement.parentNode !== container) {
        container.appendChild(state.subtitleElement);
      }
    } else if (state.subtitleElement.parentNode !== state.parentContainer) {
      state.parentContainer.appendChild(state.subtitleElement);
    }
  }
  // For JW Player, keep it above jw-button-container, no reparenting needed unless in PiP

  // Use window dimensions in fullscreen for accurate sizing
  const rect = isFullscreen ?
    { width: window.innerWidth, height: window.innerHeight, top: 0, left: 0 } :
    video.getBoundingClientRect();
  const videoHeight = isFullscreen ? window.innerHeight : rect.height;
  const videoWidth = isFullscreen ? window.innerWidth : rect.width;

  let controlBarHeight = 0;
  if (isFullscreen) {
    const checkControlBar = () => {
      let controlBar = container.querySelector(state.type === 'HTML5' ? '.ytp-chrome-bottom' : '.jw-controlbar');
      if (!controlBar) {
        controlBar = document.querySelector(state.type === 'HTML5' ? '.ytp-chrome-bottom' : '.jw-controlbar');
      }
      if (controlBar) {
        const barRect = controlBar.getBoundingClientRect();
        controlBarHeight = barRect.height || (state.type === 'HTML5' ? 60 : 60); // Default to 60px
      } else {
        controlBarHeight = state.type === 'HTML5' ? 60 : 60; // Fallback default
      }
    };
    checkControlBar();
    setTimeout(checkControlBar, 100); // Retry after a short delay for async rendering
  }

  const fontSize = state.settings?.size || 16;
  const padding = 20; // Adjusted padding for consistency

  let topPosition;
  switch (state.settings?.position || 'bottom') {
    case 'top':
      topPosition = padding;
      break;
    case 'middle':
      topPosition = (videoHeight / 2) - (fontSize / 2);
      break;
    case 'custom':
      topPosition = state.settings?.customOffset || padding;
      break;
    case 'bottom':
    default:
      topPosition = videoHeight - fontSize - padding - (isFullscreen ? controlBarHeight : 0);
  }

  // Ensure subtitle stays within bounds
  topPosition = Math.max(padding, Math.min(topPosition, videoHeight - fontSize - padding - (isFullscreen ? controlBarHeight : 0)));

  // Calculate horizontal position based on settings
  const horizontalOffset = state.settings?.horizontalOffset || 0;
  const horizontalPosition = isFullscreen ? '50%' : `${videoWidth / 2 - (videoWidth / 2) * (horizontalOffset / 100)}px`;

  Object.assign(state.subtitleElement.style, {
    position: 'absolute',
    left: isFullscreen ? '50%' : '0px',
    transform: isFullscreen ? 'translateX(-50%)' : 'none',
    top: `${topPosition}px`,
    width: isFullscreen ? 'auto' : `${videoWidth}px`,
    maxWidth: isFullscreen ? `${videoWidth - (padding * 2)}px` : 'none',
    fontFamily: state.settings?.font || 'Arial',
    fontSize: `${fontSize}px`,
    color: state.settings?.color || '#ffffff',
    backgroundColor: `${state.settings?.bgColor || '#000000'}${Math.round(
      (state.settings?.bgOpacity || 0.7) * 255
    ).toString(16).padStart(2, '0')}`,
    textAlign: horizontalOffset < -10 ? 'left' : horizontalOffset > 10 ? 'right' : 'center'
  });
}

function updateSubtitle(video) {
  const state = videoStates.get(video);
  if (!state || !state.subtitles.length) return;

  const currentTime = state.type === 'HTML5' ? video.currentTime : video.getPosition();
  const activeSubtitle = state.subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  state.subtitleElement.textContent = activeSubtitle ? activeSubtitle.text : '';
  state.subtitleElement.style.display = activeSubtitle ? 'block' : 'none';
  positionSubtitle(video);
}

function setupVideoEvents(video) {
  const state = createSubtitleElement(video);

  const eventMap = {
    play: state.type === 'HTML5' ? 'play' : 'onPlay',
    pause: state.type === 'HTML5' ? 'pause' : 'onPause',
    pipEnter: state.type === 'HTML5' ? 'enterpictureinpicture' : 'onPictureInPicture',
    pipLeave: state.type === 'HTML5' ? 'leavepictureinpicture' : 'onPictureInPicture'
  };

  const addEvent = state.type === 'HTML5' ?
    (evt, fn) => video.addEventListener(evt, fn) :
    (evt, fn) => video[evt](fn);

  addEvent(eventMap.play, () => {
    if (!state.updateInterval) {
      state.updateInterval = setInterval(() => updateSubtitle(video), 100);
    }
  });

  addEvent(eventMap.pause, () => {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  });

  addEvent(eventMap.pipEnter, () => {
    if (state.type === 'HTML5' && document.pictureInPictureElement) {
      document.pictureInPictureElement.appendChild(state.subtitleElement);
    }
    positionSubtitle(video);
  });

  addEvent(eventMap.pipLeave, () => {
    state.parentContainer.appendChild(state.subtitleElement);
    positionSubtitle(video);
  });

  if (state.type === 'HTML5') {
    const observer = new MutationObserver(() => positionSubtitle(video));
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });

    ['fullscreenchange', 'webkitfullscreenchange'].forEach(event => {
      document.addEventListener(event, () => positionSubtitle(video));
      video.addEventListener(event, () => positionSubtitle(video));
    });
    ['webkitbeginfullscreen', 'webkitendfullscreen'].forEach(event =>
      video.addEventListener(event, () => positionSubtitle(video))
    );
  } else if (state.type === 'JWPlayer') {
    video.on('fullscreen', () => positionSubtitle(video));
  }
}

function getAllVideos() {
  const html5Videos = Array.from(document.getElementsByTagName('video'));
  const iframeVideos = [];
  document.querySelectorAll('iframe').forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        iframeVideos.push(...Array.from(iframeDoc.getElementsByTagName('video')));
      }
    } catch (e) {
      // Skip cross-origin iframes
    }
  });

  const jwPlayers = [];
  if (window.jwplayer) {
    const players = document.querySelectorAll('.jwplayer, [id^="jwplayer"]');
    players.forEach(player => {
      const jwInstance = window.jwplayer(player);
      if (jwInstance && typeof jwInstance.getPosition === 'function') {
        jwPlayers.push(jwInstance);
      }
    });
  }

  return [...html5Videos, ...iframeVideos, ...jwPlayers];
}

function getVideoLink(video) {
  if (video.tagName === 'VIDEO') {
    const sources = video.querySelectorAll('source');
    if (sources.length > 0) {
      return sources[0].src;
    } else {
      return video.currentSrc || video.src;
    }
  } else if (typeof video.getPlaylist === 'function') {
    const playlist = video.getPlaylist();
    if (playlist && playlist.length > 0) {
      return playlist[0].file;
    }
  }
  return '';
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const videos = getAllVideos();

  if (message.action === 'getVideos') {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return true; // Keep the channel open for async response
  }

  if (message.action === 'getVideoLink' && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const link = getVideoLink(video);
      chrome.runtime.sendMessage({ action: 'getDetectedM3u8Urls' }, (response) => {
        const m3u8Urls = response?.m3u8Urls || [];
        sendResponse({ link: m3u8Urls.length > 0 ? m3u8Urls[m3u8Urls.length - 1] : link || '' });
      });
      return true; // Keep the channel open for async response
    } else {
      sendResponse({ link: '' });
    }
    return true;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === 'loadSubtitles' && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const state = createSubtitleElement(video);
      state.subtitles = message.subtitles;
      updateSubtitle(video);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  } else if (message.action === 'updateSubtitleSettings' && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const state = videoStates.get(video);
      if (state) {
        state.settings = message.settings;
        positionSubtitle(video);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    }
  } else if (message.action === 'togglePiP') {
    const activeVideo = videos.find(v => videoStates.get(v)?.subtitles.length > 0);
    if (activeVideo) {
      if (activeVideo.tagName) {
        if (document.pictureInPictureElement) {
          document.exitPictureInPicture();
        } else {
          activeVideo.requestPictureInPicture();
        }
      } else {
        if (activeVideo.getState() === 'pictureInPicture') {
          activeVideo.exitPictureInPicture();
        } else {
          activeVideo.enterPictureInPicture();
        }
      }
    }
  } else if (message.action === 'clearSubtitles') {
    videoStates.forEach(state => {
      state.subtitles = [];
      state.subtitleElement.style.display = 'none';
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    });
    sendResponse({ success: true });
  }
});

document.addEventListener('DOMContentLoaded', () => {
  getAllVideos().forEach(setupVideoEvents);
});