function parseSRT(content) {
  const subtitles = [];
  const blocks = content.trim().split(/\n\s*\n/);
  
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length >= 3) {
      const timeLine = lines[1].split(' --> ');
      const startTime = parseTime(timeLine[0]);
      const endTime = parseTime(timeLine[1]);
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
      Video ${index + 1} ${video.type} (${Math.round(video.duration)}s)
      <button class="add-subtitle" data-index="${index}">Add Subtitle</button>
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
        const subtitles = parseSRT(e.target.result);
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: "loadSubtitles",
            videoIndex: index,
            subtitles: subtitles
          }, (response) => {
            if (response?.success) {
              showMessage('Subtitles loaded successfully');
              document.getElementById('togglePiP').disabled = false;
            } else {
              showMessage('Error loading subtitles', true);
            }
          });
        });
      };
      reader.readAsText(fileInput.files[0]);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (response) => {
      if (response?.videos) {
        updateVideoList(response.videos);
      } else {
        showMessage('Error getting video list', true);
      }
    });
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