const videoStates = new Map();

function createSubtitleElement(video) {
  let state = videoStates.get(video);
  if (!state) {
    state = {
      subtitleElement: document.createElement('div'),
      subtitles: [],
      updateInterval: null,
      type: video.tagName ? 'HTML5' : 'JWPlayer',
      parentContainer: null
    };
    state.subtitleElement.className = 'video-subtitle';

    // Check for JW Player container
    const jwButtonContainer = video.parentElement?.querySelector('.jw-reset.jw-button-container');
    if (jwButtonContainer) {
      state.type = 'JWPlayer';
      state.parentContainer = jwButtonContainer.parentElement;
      // Insert before the button container
      state.parentContainer.insertBefore(state.subtitleElement, jwButtonContainer);
    } else {
      // Default to HTML5 video handling
      state.parentContainer = video.parentElement.querySelector('[pseudo="-webkit-media-controls"]') || video.parentElement || document.body;
      state.parentContainer.appendChild(state.subtitleElement);
    }

    videoStates.set(video, state);
  }
  return state;
}

function positionSubtitle(video) {
  const state = videoStates.get(video);
  if (!state || !state.subtitleElement) return;

  const isFullscreen = document.fullscreenElement === video || video.webkitDisplayingFullscreen;
  let container = state.parentContainer;

  if (state.type === 'HTML5') {
    if (isFullscreen) {
      container = video;
      if (state.subtitleElement.parentNode !== container) {
        container.appendChild(state.subtitleElement);
      }
    } else if (state.subtitleElement.parentNode !== state.parentContainer) {
      state.parentContainer.appendChild(state.subtitleElement);
    }
  }
  // For JW Player, keep it above jw-button-container, no reparenting needed unless in PiP

  const rect = video.getBoundingClientRect();
  const videoHeight = isFullscreen ? video.clientHeight : rect.height;
  const videoWidth = isFullscreen ? video.clientWidth : rect.width;

  state.subtitleElement.style.position = 'absolute';
  state.subtitleElement.style.left = '0px';
  state.subtitleElement.style.top = state.type === 'JWPlayer' ? 'auto' : `${videoHeight - 50}px`;
  state.subtitleElement.style.width = `${videoWidth}px`;
  state.subtitleElement.style.bottom = state.type === 'JWPlayer' ? `${rect.height}px` : 'auto'; // Position above controls for JW
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

  const playEvent = state.type === 'HTML5' ? 'play' : 'onPlay';
  const pauseEvent = state.type === 'HTML5' ? 'pause' : 'onPause';
  const pipEnterEvent = state.type === 'HTML5' ? 'enterpictureinpicture' : 'onPictureInPicture';
  const pipLeaveEvent = state.type === 'HTML5' ? 'leavepictureinpicture' : 'onPictureInPicture';

  const addEvent = state.type === 'HTML5' ?
    (evt, fn) => video.addEventListener(evt, fn) :
    (evt, fn) => video[evt](fn);

  addEvent(playEvent, () => {
    if (!state.updateInterval) {
      state.updateInterval = setInterval(() => updateSubtitle(video), 100);
    }
  });

  addEvent(pauseEvent, () => {
    clearInterval(state.updateInterval);
    state.updateInterval = null;
  });

  addEvent(pipEnterEvent, () => {
    if (state.type === 'HTML5') {
      document.pictureInPictureElement.appendChild(state.subtitleElement);
    }
    positionSubtitle(video);
  });

  addEvent(pipLeaveEvent, () => {
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

    document.addEventListener('fullscreenchange', () => positionSubtitle(video));
    document.addEventListener('webkitfullscreenchange', () => positionSubtitle(video));
    video.addEventListener('webkitbeginfullscreen', () => positionSubtitle(video));
    video.addEventListener('webkitendfullscreen', () => positionSubtitle(video));
  } else if (state.type === 'JWPlayer') {
    video.on('fullscreen', (e) => positionSubtitle(video));
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const videos = getAllVideos();

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === "loadSubtitles" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const state = createSubtitleElement(video);
      state.subtitles = message.subtitles;
      updateSubtitle(video);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  } else if (message.action === "togglePiP") {
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
  } else if (message.action === "clearSubtitles") {
    videoStates.forEach(state => {
      state.subtitles = [];
      state.subtitleElement.style.display = 'none';
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    });
    sendResponse({ success: true });
  }
});

// ... (previous code remains the same until positionSubtitle)

function positionSubtitle(video) {
  const state = videoStates.get(video)
  if (!state || !state.subtitleElement) return

  const isFullscreen = document.fullscreenElement === video || video.webkitDisplayingFullscreen
  let container = state.parentContainer

  if (state.type === "HTML5") {
    if (isFullscreen) {
      container = video
      if (state.subtitleElement.parentNode !== container) {
        container.appendChild(state.subtitleElement)
      }
    } else if (state.subtitleElement.parentNode !== state.parentContainer) {
      state.parentContainer.appendChild(state.subtitleElement)
    }
  }
  // For JW Player, keep it above jw-button-container, no reparenting needed unless in PiP

  const rect = video.getBoundingClientRect()
  const videoHeight = isFullscreen ? video.clientHeight : rect.height
  const videoWidth = isFullscreen ? video.clientWidth : rect.width

  let topPosition
  switch (state.settings?.position || "bottom") {
    case "top":
      topPosition = 0
      break
    case "middle":
      topPosition = videoHeight / 2 - (state.settings?.size || 16) / 2
      break
    case "custom":
      topPosition = state.settings?.customOffset || 0
      break
    case "bottom":
    default:
      topPosition = videoHeight - (state.settings?.size || 16) - 20 // Adjust for padding
  }

  // Calculate horizontal position based on settings
  const horizontalOffset = state.settings?.horizontalOffset || 0
  const horizontalPosition = videoWidth / 2 - (videoWidth / 2) * (horizontalOffset / 100)

  state.subtitleElement.style.position = "absolute"
  state.subtitleElement.style.left = `0px`
  state.subtitleElement.style.top = `${topPosition}px`
  state.subtitleElement.style.width = `${videoWidth}px`
  state.subtitleElement.style.fontFamily = state.settings?.font || "Arial"
  state.subtitleElement.style.fontSize = `${state.settings?.size || 16}px`
  state.subtitleElement.style.color = state.settings?.color || "#ffffff"
  state.subtitleElement.style.backgroundColor = `${state.settings?.bgColor || "#000000"}${Math.round(
    (state.settings?.bgOpacity || 0.7) * 255,
  )
    .toString(16)
    .padStart(2, "0")}`

  // Add text alignment based on horizontal position
  if (horizontalOffset < -10) {
    state.subtitleElement.style.textAlign = "left"
  } else if (horizontalOffset > 10) {
    state.subtitleElement.style.textAlign = "right"
  } else {
    state.subtitleElement.style.textAlign = "center"
  }
}

// ... (updateSubtitle and setupVideoEvents remain the same)

// Add new message handler in chrome.runtime.onMessage.addListener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const videos = getAllVideos();

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === "loadSubtitles" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const state = createSubtitleElement(video);
      state.subtitles = message.subtitles;
      updateSubtitle(video);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  } else if (message.action === "updateSubtitleSettings" && message.videoIndex !== undefined) {
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
  } else if (message.action === "togglePiP") {
    // ... (existing togglePiP logic)
  } else if (message.action === "clearSubtitles") {
    // ... (existing clearSubtitles logic)
  }
});

// ... (previous code remains the same until chrome.runtime.onMessage.addListener)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const videos = getAllVideos();

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return;
  }

  if (message.action === "getVideoLink" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      let link = '';
      if (video.tagName === 'VIDEO') {
        // HTML5 video: check <source> tags first, then currentSrc
        const sources = video.querySelectorAll('source');
        if (sources.length > 0) {
          link = sources[0].src; // Take the first source
        } else {
          link = video.currentSrc || video.src;
        }
      } else if (typeof video.getPlaylist === 'function') {
        // JW Player
        const playlist = video.getPlaylist();
        if (playlist && playlist.length > 0) {
          link = playlist[0].file; // Get the file URL from JW Player playlist
        }
      }
      sendResponse({ link: link || '' });
    } else {
      sendResponse({ link: '' });
    }
    return;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === "loadSubtitles" && message.videoIndex !== undefined) {
    // ... (existing loadSubtitles logic)
  } else if (message.action === "updateSubtitleSettings" && message.videoIndex !== undefined) {
    // ... (existing updateSubtitleSettings logic)
  } else if (message.action === "togglePiP") {
    // ... (existing togglePiP logic)
  } else if (message.action === "clearSubtitles") {
    // ... (existing clearSubtitles logic)
  }
});
// ... (previous code remains the same)

// This function is already sufficient
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

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return;
  }

  if (message.action === "getVideoLink" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const link = getVideoLink(video);
      sendResponse({ link: link || '' });
    } else {
      sendResponse({ link: '' });
    }
    return;
  }

  // ... (rest of the existing handlers)
});
// ... (previous code remains the same until getAllVideos)

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

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return true; // Keep the message channel open for async response
  }

  if (message.action === "getVideoLink" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      let link = getVideoLink(video);
      // Check background script for detected .m3u8 URLs
      chrome.runtime.sendMessage({ action: "getDetectedM3u8Urls" }, (response) => {
        const m3u8Urls = response?.m3u8Urls || [];
        // Use the most recent .m3u8 URL if available, otherwise fall back to video link
        link = m3u8Urls.length > 0 ? m3u8Urls[m3u8Urls.length - 1] : link;
        sendResponse({ link: link || '' });
      });
      return true; // Keep the message channel open for async response
    } else {
      sendResponse({ link: '' });
    }
    return true;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === "loadSubtitles" && message.videoIndex !== undefined) {
    // ... (existing loadSubtitles logic)
  } else if (message.action === "updateSubtitleSettings" && message.videoIndex !== undefined) {
    // ... (existing updateSubtitleSettings logic)
  } else if (message.action === "togglePiP") {
    // ... (existing togglePiP logic)
  } else if (message.action === "clearSubtitles") {
    // ... (existing clearSubtitles logic)
  }
});


// ... (previous code remains the same until chrome.runtime.onMessage.addListener)

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

  if (message.action === "getVideos") {
    sendResponse({
      videos: videos.map(v => ({
        duration: v.duration || (v.getDuration ? v.getDuration() : 0),
        type: v.tagName ? 'HTML5' : 'JWPlayer'
      }))
    });
    return true; // Keep the channel open for async response
  }

  if (message.action === "getVideoLink" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const link = getVideoLink(video);
      sendResponse({ link: link || '' });
    } else {
      sendResponse({ link: '' });
    }
    return true;
  }

  videos.forEach(setupVideoEvents);

  if (message.action === "loadSubtitles" && message.videoIndex !== undefined) {
    const video = videos[message.videoIndex];
    if (video) {
      const state = createSubtitleElement(video);
      state.subtitles = message.subtitles;
      updateSubtitle(video);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
  } else if (message.action === "togglePiP") {
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
  } else if (message.action === "clearSubtitles") {
    videoStates.forEach(state => {
      state.subtitles = [];
      state.subtitleElement.style.display = 'none';
      clearInterval(state.updateInterval);
      state.updateInterval = null;
    });
    sendResponse({ success: true });
  }
});