const videoStates = new Map();

function createSubtitleElement(video) {
  let state = videoStates.get(video);
  if (!state) {
    state = {
      subtitleElement: document.createElement('div'),
      infoElement: document.createElement('div'), // New element for showing frame info
      subtitles: [],
      updateInterval: null,
      type: detectPlayerType(video),
      parentContainer: null,
      settings: {}
    };
    state.subtitleElement.className = 'video-subtitle';
    state.infoElement.className = 'video-info'; // Class for styling info display
    state.infoElement.style.cssText = `
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 5px 10px;
      border-radius: 3px;
      z-index: 1000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      display: none;
    `;

    state.parentContainer = findParentContainer(video, state.type);
    state.parentContainer.appendChild(state.subtitleElement);
    state.parentContainer.appendChild(state.infoElement);

    videoStates.set(video, state);
  }
  return state;
}

function detectPlayerType(video) {
  if (video.tagName === 'VIDEO') return 'HTML5';
  if (window.jwplayer && typeof video.getPosition === 'function') return 'JWPlayer';
  if (video.className?.includes('video-js') || video.player) return 'VideoJS';
  if (video.className?.includes('plyr') || video.plyr) return 'Plyr';
  if (video.src?.includes('vimeo') || video.id?.includes('vimeo')) return 'Vimeo';
  return 'Unknown';
}

function findParentContainer(video, type) {
  switch (type) {
    case 'JWPlayer':
      return video.parentElement?.querySelector('.jw-reset.jw-button-container')?.parentElement || video.parentElement;
    case 'VideoJS':
      return video.parentElement?.querySelector('.vjs-control-bar')?.parentElement || video.parentElement;
    case 'Plyr':
      return video.parentElement?.querySelector('.plyr__controls')?.parentElement || video.parentElement;
    case 'Vimeo':
      return video.parentElement || document.body;
    case 'HTML5':
    default:
      return video.parentElement?.querySelector('[pseudo="-webkit-media-controls"]') ||
             video.parentElement ||
             document.body;
  }
}

function getContainerInfo(container) {
  const info = {
    tag: container.tagName.toLowerCase(),
    class: container.className || 'none',
    id: container.id || 'none'
  };
  return `Container: <${info.tag} class="${info.class}" id="${info.id}">`;
}

function positionSubtitle(video) {
  const state = videoStates.get(video);
  if (!state || !state.subtitleElement) return;

  const isFullscreen = document.fullscreenElement === video ||
                      video.webkitDisplayingFullscreen ||
                      document.webkitFullscreenElement === video;
  let container = state.parentContainer;

  if (state.type === 'HTML5' || state.type === 'VideoJS' || state.type === 'Plyr') {
    if (isFullscreen) {
      container = video;
      if (state.subtitleElement.parentNode !== container) {
        container.appendChild(state.subtitleElement);
        container.appendChild(state.infoElement);
      }
      // Show container info when entering fullscreen
      state.infoElement.textContent = getContainerInfo(container);
      state.infoElement.style.display = 'block';
      // Hide after 3 seconds
      setTimeout(() => {
        state.infoElement.style.display = 'none';
      }, 3000);
    } else {
      if (state.subtitleElement.parentNode !== state.parentContainer) {
        state.parentContainer.appendChild(state.subtitleElement);
        state.parentContainer.appendChild(state.infoElement);
      }
      state.infoElement.style.display = 'none';
    }
  }

  const rect = video.getBoundingClientRect();
  const videoHeight = isFullscreen ? video.clientHeight : rect.height;
  const videoWidth = isFullscreen ? video.clientWidth : rect.width;

  let topPosition;
  switch (state.settings?.position || 'bottom') {
    case 'top':
      topPosition = 0;
      break;
    case 'middle':
      topPosition = videoHeight / 2 - (state.settings?.size || 16) / 2;
      break;
    case 'custom':
      topPosition = state.settings?.customOffset || 0;
      break;
    case 'bottom':
    default:
      topPosition = videoHeight - (state.settings?.size || 16) - 20;
  }

  const horizontalOffset = state.settings?.horizontalOffset || 0;

  Object.assign(state.subtitleElement.style, {
    position: 'absolute',
    left: '0px',
    top: `${topPosition}px`,
    width: `${videoWidth}px`,
    fontFamily: state.settings?.font || 'Arial',
    fontSize: `${state.settings?.size || 16}px`,
    color: state.settings?.color || '#ffffff',
    backgroundColor: `${state.settings?.bgColor || '#000000'}${Math.round(
      (state.settings?.bgOpacity || 0.7) * 255
    ).toString(16).padStart(2, '0')}`,
    textAlign: horizontalOffset < -10 ? 'left' : horizontalOffset > 10 ? 'right' : 'center'
  });
}

// Rest of the original functions remain largely unchanged
function updateSubtitle(video) {
  const state = videoStates.get(video);
  if (!state || !state.subtitles.length) return;

  const currentTime = getCurrentTime(video, state.type);
  const activeSubtitle = state.subtitles.find(
    sub => currentTime >= sub.startTime && currentTime <= sub.endTime
  );

  state.subtitleElement.textContent = activeSubtitle ? activeSubtitle.text : '';
  state.subtitleElement.style.display = activeSubtitle ? 'block' : 'none';
  positionSubtitle(video);
}

function getCurrentTime(video, type) {
  switch (type) {
    case 'HTML5':
      return video.currentTime;
    case 'JWPlayer':
      return video.getPosition();
    case 'VideoJS':
      return video.player?.currentTime();
    case 'Plyr':
      return video.plyr?.currentTime;
    case 'Vimeo':
      return video.currentTime || 0;
    default:
      return 0;
  }
}

function setupVideoEvents(video) {
  const state = createSubtitleElement(video);
  const type = state.type;

  const eventMap = {
    play: getEventName(type, 'play'),
    pause: getEventName(type, 'pause'),
    pipEnter: getEventName(type, 'pipEnter'),
    pipLeave: getEventName(type, 'pipLeave')
  };

  const addEvent = getEventAdder(video, type);

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
    if (type === 'HTML5' && document.pictureInPictureElement) {
      document.pictureInPictureElement.appendChild(state.subtitleElement);
      document.pictureInPictureElement.appendChild(state.infoElement);
    }
    positionSubtitle(video);
  });

  addEvent(eventMap.pipLeave, () => {
    state.parentContainer.appendChild(state.subtitleElement);
    state.parentContainer.appendChild(state.infoElement);
    positionSubtitle(video);
  });

  setupFullscreenEvents(video, type);
}

function getEventName(type, event) {
  const events = {
    HTML5: {
      play: 'play',
      pause: 'pause',
      pipEnter: 'enterpictureinpicture',
      pipLeave: 'leavepictureinpicture'
    },
    JWPlayer: {
      play: 'onPlay',
      pause: 'onPause',
      pipEnter: 'onPictureInPicture',
      pipLeave: 'onPictureInPicture'
    },
    VideoJS: {
      play: 'play',
      pause: 'pause',
      pipEnter: 'enterpictureinpicture',
      pipLeave: 'leavepictureinpicture'
    },
    Plyr: {
      play: 'playing',
      pause: 'pause',
      pipEnter: 'enterpictureinpicture',
      pipLeave: 'leavepictureinpicture'
    },
    Vimeo: {
      play: 'play',
      pause: 'pause',
      pipEnter: 'enterpictureinpicture',
      pipLeave: 'leavepictureinpicture'
    }
  };
  return events[type]?.[event] || events.HTML5[event];
}

function getEventAdder(video, type) {
  switch (type) {
    case 'HTML5':
    case 'Vimeo':
      return (evt, fn) => video.addEventListener(evt, fn);
    case 'JWPlayer':
      return (evt, fn) => video[evt](fn);
    case 'VideoJS':
      return (evt, fn) => video.player?.on(evt, fn);
    case 'Plyr':
      return (evt, fn) => video.plyr?.on(evt, fn);
    default:
      return (evt, fn) => video.addEventListener(evt, fn);
  }
}

function setupFullscreenEvents(video, type) {
  const fullscreenHandler = () => positionSubtitle(video);

  if (type === 'HTML5' || type === 'VideoJS' || type === 'Plyr' || type === 'Vimeo') {
    const observer = new MutationObserver(fullscreenHandler);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['style', 'class']
    });

    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange'].forEach(event =>
      document.addEventListener(event, fullscreenHandler)
    );
    ['webkitbeginfullscreen', 'webkitendfullscreen'].forEach(event =>
      video.addEventListener(event, fullscreenHandler)
    );
  } else if (type === 'JWPlayer') {
    video.on('fullscreen', fullscreenHandler);
  }
}

// Rest of the original code remains unchanged
function getAllVideos() {
  const html5Videos = Array.from(document.getElementsByTagName('video'));
  const iframeVideos = [];
  const iframes = document.querySelectorAll('iframe');

  iframes.forEach(iframe => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (iframeDoc) {
        iframeVideos.push(...Array.from(iframeDoc.getElementsByTagName('video')));
      }
    } catch (e) {}
  });

  const jwPlayers = window.jwplayer ?
    Array.from(document.querySelectorAll('.jwplayer, [id^="jwplayer"]'))
      .map(player => window.jwplayer(player))
      .filter(jw => jw?.getPosition) : [];

  const videoJsPlayers = Array.from(document.getElementsByClassName('video-js'))
    .filter(v => v.player);

  const plyrPlayers = Array.from(document.getElementsByClassName('plyr'))
    .filter(v => v.plyr);

  const vimeoPlayers = Array.from(document.querySelectorAll('iframe[src*="vimeo"], [id*="vimeo"]'));

  return [...html5Videos, ...iframeVideos, ...jwPlayers, ...videoJsPlayers, ...plyrPlayers, ...vimeoPlayers];
}

function getVideoLink(video) {
  const type = detectPlayerType(video);
  switch (type) {
    case 'HTML5':
      const sources = video.querySelectorAll('source');
      return sources.length > 0 ? sources[0].src : (video.currentSrc || video.src);
    case 'JWPlayer':
      const playlist = video.getPlaylist();
      return playlist?.length > 0 ? playlist[0].file : '';
    case 'VideoJS':
      return video.player?.currentSrc() || '';
    case 'Plyr':
      return video.plyr?.source?.sources?.[0]?.src || '';
    case 'Vimeo':
      return video.src || '';
    default:
      return '';
  }
}

function findVideoFromPlayButton(button) {
  const knownPlaySelectors = [
    '.jw-icon-playback',
    '.vjs-play-control',
    '.plyr__control--play',
    '[data-plyr="play"]',
    '.play',
    '[class*="play"]',
    'button'
  ];

  let container = button.closest('div, section, article') || button.parentElement;
  let video = null;

  const allVideos = getAllVideos();
  video = allVideos.find(v => container.contains(v) || v.contains(container));

  if (!video) {
    document.querySelectorAll('iframe').forEach(iframe => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.contains(button)) {
          video = iframeDoc.querySelector('video') ||
                  Array.from(iframeDoc.querySelectorAll('.jwplayer, [id^="jwplayer"]'))
                    .map(player => window.jwplayer(player))
                    .find(jw => jw?.getPosition) ||
                  iframeDoc.querySelector('.video-js') ||
                  iframeDoc.querySelector('.plyr');
        }
      } catch (e) {}
    });
  }

  return video || container.querySelector('video');
}

function setupPlayButtonListeners() {
  const playButtonSelectors = [
    '.jw-icon-playback',
    '.vjs-play-control',
    '.plyr__control--play',
    '[data-plyr="play"]',
    '.play',
    '[class*="play"]',
    'button:not([type]), button[type="button"]'
  ];

  const playButtons = document.querySelectorAll(playButtonSelectors.join(','));

  playButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const video = findVideoFromPlayButton(button);
      if (video) {
        setupVideoEvents(video);
        const type = detectPlayerType(video);
        switch (type) {
          case 'HTML5':
          case 'Vimeo':
            video.play();
            break;
          case 'JWPlayer':
            video.play();
            break;
          case 'VideoJS':
            video.player?.play();
            break;
          case 'Plyr':
            video.plyr?.play();
            break;
        }
      }
    });
  });

  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        setupPlayButtonListeners();
      }
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const videos = getAllVideos();

  switch (message.action) {
    case 'getVideos':
      sendResponse({
        videos: videos.map(v => ({
          duration: getDuration(v, detectPlayerType(v)),
          type: detectPlayerType(v)
        }))
      });
      break;

    case 'getVideoLink':
      if (message.videoIndex !== undefined) {
        const video = videos[message.videoIndex];
        if (video) {
          chrome.runtime.sendMessage({ action: 'getDetectedM3u8Urls' }, (response) => {
            const m3u8Urls = response?.m3u8Urls || [];
            const link = m3u8Urls.length > 0 ? m3u8Urls[m3u8Urls.length - 1] : getVideoLink(video);
            sendResponse({ link: link || '' });
          });
          return true;
        }
        sendResponse({ link: '' });
      }
      break;

    case 'loadSubtitles':
      if (message.videoIndex !== undefined) {
        const video = videos[message.videoIndex];
        if (video) {
          const state = createSubtitleElement(video);
          state.subtitles = message.subtitles;
          updateSubtitle(video);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      }
      break;

    case 'updateSubtitleSettings':
      if (message.videoIndex !== undefined) {
        const video = videos[message.videoIndex];
        if (video && videoStates.get(video)) {
          const state = videoStates.get(video);
          state.settings = message.settings;
          positionSubtitle(video);
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false });
        }
      }
      break;

    case 'togglePiP':
      const activeVideo = videos.find(v => videoStates.get(v)?.subtitles.length > 0);
      if (activeVideo) {
        togglePiP(activeVideo, detectPlayerType(activeVideo));
      }
      break;

    case 'clearSubtitles':
      videoStates.forEach(state => {
        state.subtitles = [];
        state.subtitleElement.style.display = 'none';
        clearInterval(state.updateInterval);
        state.updateInterval = null;
      });
      sendResponse({ success: true });
      break;
  }

  return true;
});

function getDuration(video, type) {
  switch (type) {
    case 'HTML5':
      return video.duration;
    case 'JWPlayer':
      return video.getDuration();
    case 'VideoJS':
      return video.player?.duration();
    case 'Plyr':
      return video.plyr?.duration;
    case 'Vimeo':
      return video.duration || 0;
    default:
      return 0;
  }
}

function togglePiP(video, type) {
  switch (type) {
    case 'HTML5':
    case 'VideoJS':
    case 'Plyr':
      document.pictureInPictureElement ?
        document.exitPictureInPicture() :
        video.requestPictureInPicture();
      break;
    case 'JWPlayer':
      video.getState() === 'pictureInPicture' ?
        video.exitPictureInPicture() :
        video.enterPictureInPicture();
      break;
    case 'Vimeo':
      break;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  setupPlayButtonListeners();
  getAllVideos().forEach(setupVideoEvents);
});