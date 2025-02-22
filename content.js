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