chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url.toLowerCase();
    console.log('Intercepted request:', url); // Log every request
    if (url.includes('googlevideo.com')) {
      console.log('Skipping googlevideo URL:', url);
      return;
    }
    if (url.endsWith('.m3u8') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ts') || url.includes('video')) {
      console.log('Detected video URL:', url);
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          const pageKey = `savedVideoUrls_${tabs[0].url}`;
          console.log('Current tab URL:', tabs[0].url);
          chrome.storage.sync.get([pageKey], (result) => {
            const savedUrls = result[pageKey] || [];
            console.log('Current saved URLs:', savedUrls);
            if (!savedUrls.some(entry => entry.url === details.url)) {
              savedUrls.push({ url: details.url, timestamp: Date.now() });
              chrome.storage.sync.set({ [pageKey]: savedUrls }, () => {
                console.log('Saved video URL for', tabs[0].url, ':', details.url);
              });
            } else {
              console.log('URL already saved:', details.url);
            }
          });
        } else {
          console.log('No active tab found');
        }
      });
    } else {
      console.log('URL not matched for video:', url);
    }
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] }
);

// Message listener for debugging
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Received message:', message);
  if (message.action === "getExtensionId") {
    sendResponse({ extensionId: chrome.runtime.id });
  } else if (message.action === "getDetectedVideoUrls") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        const pageKey = `savedVideoUrls_${tabs[0].url}`;
        chrome.storage.sync.get([pageKey], (result) => {
          const videoUrls = result[pageKey] || [];
          console.log('Sending video URLs:', videoUrls);
          sendResponse({ videoUrls: videoUrls });
        });
      } else {
        console.log('No active tab for getDetectedVideoUrls');
        sendResponse({ videoUrls: [] });
      }
    });
    return true; // Keep the channel open for async response
  }
});