chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    const url = details.url.toLowerCase();
    if (url.includes('googlevideo.com')) {
      return; // Skip saving this URL
    }
    if (url.endsWith('.m3u8') || url.endsWith('.mp4') || url.endsWith('.webm') || url.endsWith('.ts') || url.includes('video')) {
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
          const pageKey = `savedVideoUrls_${tabs[0].url}`;
          chrome.storage.sync.get([pageKey], (result) => {
            const savedUrls = result[pageKey] || [];
            if (!savedUrls.some(entry => entry.url === details.url)) {
              savedUrls.push({ url: details.url, timestamp: Date.now() });
              chrome.storage.sync.set({ [pageKey]: savedUrls }, () => {
                console.log('Saved video URL for', tabs[0].url, ':', details.url);
              });
            }
          });
        }
      });
    }
  },
  { urls: ["<all_urls>"], types: ["media", "xmlhttprequest", "other"] }
);

// Add listener to return extension ID
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getExtensionId") {
    sendResponse({ extensionId: chrome.runtime.id });
  } else if (message.action === "getDetectedVideoUrls") {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        const pageKey = `savedVideoUrls_${tabs[0].url}`;
        chrome.storage.sync.get([pageKey], (result) => {
          sendResponse({ videoUrls: result[pageKey] || [] });
        });
      } else {
        sendResponse({ videoUrls: [] });
      }
    });
    return true; // Keep the channel open for async response
  }
});