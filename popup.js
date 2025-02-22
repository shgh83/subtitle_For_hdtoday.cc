function parseSRT(content, delay = 0) {
  const subtitles = [];
  const blocks = content.trim().split(/\n\s*\n/);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1].split(' --> ');
      const startTime = parseTime(timeLine[0]) + delay;
      const endTime = parseTime(timeLine[1]) + delay;
      const text = lines.slice(2).join('\n');
      subtitles.push({ startTime, endTime, text });
    }
  }
  return subtitles;
}

function parseTime(timeStr) {
  const [hours, minutes, seconds] = timeStr.replace(',', '.').split(':');
  return parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseFloat(seconds);
}

function showMessage(text, isError = false) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = text;
  messageDiv.className = isError ? 'error' : 'success';
  setTimeout(() => messageDiv.textContent = '', 3000);
}

function updateVideoList(videos) {
  const videoList = document.getElementById('videoList');
  videoList.innerHTML = '';

  if (videos.length === 0) {
    videoList.innerHTML = 'No videos found on this page';
    return;
  }

  videos.forEach((video, index) => {
    const div = document.createElement('div');
    div.className = 'video-item';
    div.innerHTML = `
      <span>Video ${index + 1} ${video.type} (${Math.round(video.duration)}s)</span>
      <div class="video-buttons">
        <button class="add-subtitle" data-index="${index}">Add Subtitle</button>
        <button class="copy-link" data-index="${index}">Copy Link</button>
      </div>
    `;
    videoList.appendChild(div);
  });

  document.querySelectorAll('.add-subtitle').forEach(button => {
    button.addEventListener('click', () => {
      const fileInput = document.getElementById('srtFile');
      const index = parseInt(button.dataset.index);

      if (!fileInput.files[0]) {
        showMessage('Please select an SRT file first', true);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const delay = parseFloat(document.getElementById('subtitleDelay').value) || 0;
        const subtitles = parseSRT(e.target.result, delay);
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "loadSubtitles",
            videoIndex: index,
            subtitles: subtitles
          }, (response) => {
            if (response?.success) {
              showMessage('Subtitles loaded successfully');
              document.getElementById('togglePiP').disabled = false;
              applySettings(index);
            } else {
              showMessage('Error loading subtitles', true);
            }
          });
        });
      };
      reader.readAsText(fileInput.files[0]);
    });
  });

  document.querySelectorAll('.copy-link').forEach(button => {
    button.addEventListener('click', copyLinkHandler);
  });
}

function updateDownloadList(networkUrls) {
  const downloadList = document.getElementById('downloadList');
  downloadList.innerHTML = '';

  if (networkUrls.length === 0) {
    downloadList.innerHTML = 'No download links saved for this page';
    return;
  }

  // Sort URLs: .ts and .m3u8 first, then others, maintaining chronological order within groups
  const sortedUrls = networkUrls.slice().sort((a, b) => {
    const aIsPriority = a.url.includes('.ts') || a.url.includes('.m3u8');
    const bIsPriority = b.url.includes('.ts') || b.url.includes('.m3u8');

    if (aIsPriority && !bIsPriority) return -1; // a comes first
    if (!aIsPriority && bIsPriority) return 1;  // b comes first
    return b.timestamp - a.timestamp;           // Within same group, newest first
  });

  sortedUrls.forEach((entry, index) => {
    const div = document.createElement('div');
    div.className = 'download-item';
    div.innerHTML = `
      <span>${entry.url.split('/').pop().substring(0, 20)}... (${new Date(entry.timestamp).toLocaleTimeString()})</span>
      <div class="download-buttons">
        <button class="copy-link" data-network-index="${index}">Copy Link</button>
      </div>
    `;
    downloadList.appendChild(div);
  });

  document.querySelectorAll('.copy-link').forEach(button => {
    button.removeEventListener('click', copyLinkHandler); // Remove previous listeners
    button.addEventListener('click', () => {
      const networkIndex = parseInt(button.dataset.networkIndex);
      const url = sortedUrls[networkIndex]?.url;
      if (url) {
        navigator.clipboard.writeText(url)
          .then(() => showMessage('Link copied to clipboard'))
          .catch(() => showMessage('Failed to copy link', true));
      } else {
        showMessage('No downloadable link found for network video', true);
      }
    });
  });
}

function copyLinkHandler(event) {
  const button = event.target;
  const index = button.dataset.index ? parseInt(button.dataset.index) : null;

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (index !== null) {
      // Copy link from video element
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "getVideoLink",
        videoIndex: index
      }, (response) => {
        if (response?.link) {
          navigator.clipboard.writeText(response.link)
            .then(() => showMessage('Link copied to clipboard'))
            .catch(() => showMessage('Failed to copy link', true));
        } else {
          showMessage('No downloadable link found for video', true);
        }
      });
    }
  });
}

function applySettings(videoIndex) {
  const settings = {
    position: document.getElementById('subtitlePosition').value,
    customOffset: parseInt(document.getElementById('customOffset').value) || 0,
    font: document.getElementById('subtitleFont').value,
    size: parseInt(document.getElementById('subtitleSize').value) || 16,
    color: document.getElementById('subtitleColor').value,
    bgColor: document.getElementById('subtitleBgColor').value,
    bgOpacity: parseFloat(document.getElementById('subtitleBgOpacity').value) || 0.7
  };

  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, {
      action: "updateSubtitleSettings",
      videoIndex: videoIndex,
      settings: settings
    }, (response) => {
      if (response?.success) {
        showMessage('Settings applied successfully');
      } else {
        showMessage('Error applying settings', true);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching logic
  const videoTab = document.getElementById('videoTab');
  const downloadTab = document.getElementById('downloadTab');
  const videoTabContent = document.getElementById('videoTabContent');
  const downloadTabContent = document.getElementById('downloadTabContent');

  videoTab.addEventListener('click', () => {
    videoTab.classList.add('active');
    downloadTab.classList.remove('active');
    videoTabContent.classList.add('active');
    downloadTabContent.classList.remove('active');
  });

  downloadTab.addEventListener('click', () => {
    videoTab.classList.remove('active');
    downloadTab.classList.add('active');
    videoTabContent.classList.remove('active');
    downloadTabContent.classList.add('active');
  });

  // Automatically detect videos and load saved network URLs for current page
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    const pageKey = `savedVideoUrls_${tabs[0].url}`;
    chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (videoResponse) => {
      const videos = videoResponse?.videos || [];
      updateVideoList(videos);
    });
    chrome.storage.sync.get([pageKey], (result) => {
      const savedUrls = result[pageKey] || [];
      updateDownloadList(savedUrls);
    });
  });

  // Manual refresh/search functionality: clear links for current page and refresh
  document.getElementById('searchVideos').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      const pageKey = `savedVideoUrls_${tabs[0].url}`;
      chrome.storage.sync.set({ [pageKey]: [] }, () => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (videoResponse) => {
          const videos = videoResponse?.videos || [];
          updateVideoList(videos);
          updateDownloadList([]); // Clear the display immediately
          showMessage('Videos and download links refreshed');
        });
      });
    });
  });

  document.getElementById('subtitlePosition').addEventListener('change', (e) => {
    document.getElementById('customOffset').style.display = e.target.value === 'custom' ? 'block' : 'none';
  });

  document.getElementById('applySettings').addEventListener('click', () => {
    const videoIndex = document.querySelector('.add-subtitle[data-index]:not([disabled])')?.dataset.index;
    if (videoIndex !== undefined) {
      applySettings(parseInt(videoIndex));
    } else {
      showMessage('Load subtitles for a video first', true);
    }
  });

  document.getElementById('togglePiP').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "togglePiP" });
    });
  });

  document.getElementById('clearSubtitles').addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "clearSubtitles" }, () => {
        showMessage('Subtitles cleared');
        document.getElementById('togglePiP').disabled = true;
      });
    });
  });
});