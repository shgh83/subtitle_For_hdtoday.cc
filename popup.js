// Translations object from the original code
const translations = {
  fa: {
    title: "زیرنویس کننده ویدیو",
    refresh: "بروزرسانی/جستجوی ویدیوها",
    selectSrt: "انتخاب فایل SRT",
    videos: "ویدیوها",
    downloadLinks: "لینک‌های دانلود",
    noVideos: "هیچ ویدیویی در این صفحه یافت نشد",
    noDownloads: "هیچ لینک دانلودی برای این صفحه ذخیره نشده است",
    settings: "تنظیمات",
    position: "موقعیت",
    bottom: "پایین",
    middle: "وسط",
    top: "بالا",
    custom: "سفارشی",
    customOffsetPlaceholder: "فاصله (پیکسل)",
    font: "فونت",
    size: "اندازه",
    textColor: "رنگ متن",
    bgColor: "رنگ پس‌زمینه",
    bgOpacity: "شفافیت پس‌زمینه",
    delay: "تأخیر (ثانیه)",
    applySettings: "اعمال تنظیمات",
    togglePiP: "تغییر حالت PiP",
    pipTooltip: "نمایش ویدیو در پنجره کوچک",
    clearSubtitles: "پاک کردن زیرنویس‌ها",
    addSubtitle: "افزودن زیرنویس",
    copyLink: "کپی لینک",
    video: "ویدیو",
    linkCopied: "لینک در کلیپ‌بورد کپی شد",
    copyFailed: "کپی لینک با خطا مواجه شد",
    subtitlesLoaded: "زیرنویس‌ها با موفقیت بارگذاری شدند",
    loadError: "خطا در بارگذاری زیرنویس‌ها",
    selectSrtFirst: "لطفاً ابتدا یک فایل SRT انتخاب کنید",
    loadSubtitlesFirst: "ابتدا زیرنویس‌ها را برای یک ویدیو بارگذاری کنید",
    subtitlesCleared: "زیرنویس‌ها پاک شدند",
    settingsApplied: "تنظیمات با موفقیت اعمال شدند",
    settingsError: "خطا در اعمال تنظیمات",
    videosRefreshed: "ویدیوها و لینک‌های دانلود بروزرسانی شدند",
    noLinkFound: "هیچ لینک قابل دانلودی برای ویدیو یافت نشد",
    fileSelected: "فایل انتخاب شد: ",
  },
  en: {
    title: "Video Subtitler",
    refresh: "Refresh/Search Videos",
    selectSrt: "Select SRT File",
    videos: "Videos",
    downloadLinks: "Download Links",
    noVideos: "No videos found on this page",
    noDownloads: "No download links saved for this page",
    settings: "Settings",
    position: "Position",
    bottom: "Bottom",
    middle: "Middle",
    top: "Top",
    custom: "Custom",
    customOffsetPlaceholder: "Offset (px)",
    font: "Font",
    size: "Size",
    textColor: "Text Color",
    bgColor: "Background Color",
    bgOpacity: "Background Opacity",
    delay: "Delay (seconds)",
    applySettings: "Apply Settings",
    togglePiP: "Toggle PiP",
    pipTooltip: "Picture-in-Picture mode",
    clearSubtitles: "Clear Subtitles",
    addSubtitle: "Add Subtitle",
    copyLink: "Copy Link",
    video: "Video",
    linkCopied: "Link copied to clipboard",
    copyFailed: "Failed to copy link",
    subtitlesLoaded: "Subtitles loaded successfully",
    loadError: "Error loading subtitles",
    selectSrtFirst: "Please select an SRT file first",
    loadSubtitlesFirst: "Load subtitles for a video first",
    subtitlesCleared: "Subtitles cleared",
    settingsApplied: "Settings applied successfully",
    settingsError: "Error applying settings",
    videosRefreshed: "Videos and download links refreshed",
    noLinkFound: "No downloadable link found for video",
    fileSelected: "File selected: ",
  },
}

// Current language (default to Farsi)
let currentLang = "fa"

// Function to parse SRT files
function parseSRT(content, delay = 0) {
  const subtitles = []
  const blocks = content.trim().split(/\n\s*\n/)

  for (const block of blocks) {
    const lines = block.trim().split("\n")
    if (lines.length >= 3) {
      const timeLine = lines[1].split(" --> ")
      const startTime = parseTime(timeLine[0]) + delay
      const endTime = parseTime(timeLine[1]) + delay
      const text = lines.slice(2).join("\n")
      subtitles.push({ startTime, endTime, text })
    }
  }
  return subtitles
}

function parseTime(timeStr) {
  const [hours, minutes, seconds] = timeStr.replace(",", ".").split(":")
  return Number.parseInt(hours) * 3600 + Number.parseInt(minutes) * 60 + Number.parseFloat(seconds)
}

function showMessage(text, isError = false) {
  const messageDiv = document.getElementById("message")
  messageDiv.textContent = text
  messageDiv.className = isError ? "error" : "success"
  setTimeout(() => (messageDiv.textContent = ""), 3000)
}

function updateVideoList(videos) {
  const videoList = document.getElementById("videoList")
  videoList.innerHTML = ""

  if (videos.length === 0) {
    videoList.setAttribute("data-empty-text", translations[currentLang].noVideos)
    return
  }

  videos.forEach((video, index) => {
    const div = document.createElement("div")
    div.className = "video-item"
    div.innerHTML = `
      <span>${translations[currentLang].video} ${index + 1} ${video.type} (${Math.round(video.duration)}s)</span>
      <div class="video-buttons">
        <button class="add-subtitle" data-index="${index}">${translations[currentLang].addSubtitle}</button>
        <button class="copy-link" data-index="${index}">${translations[currentLang].copyLink}</button>
      </div>
    `
    videoList.appendChild(div)
  })

  document.querySelectorAll(".add-subtitle").forEach((button) => {
    button.addEventListener("click", () => {
      const fileInput = document.getElementById("srtFile")
      const index = Number.parseInt(button.dataset.index)

      if (!fileInput.files[0]) {
        showMessage(translations[currentLang].selectSrtFirst, true)
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const delay = Number.parseFloat(document.getElementById("subtitleDelay").value) || 0
        const subtitles = parseSRT(e.target.result, delay)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          chrome.tabs.sendMessage(
            tabs[0].id,
            {
              action: "loadSubtitles",
              videoIndex: index,
              subtitles: subtitles,
            },
            (response) => {
              if (response?.success) {
                showMessage(translations[currentLang].subtitlesLoaded)
                document.getElementById("togglePiP").disabled = false
                applySettings(index)
              } else {
                showMessage(translations[currentLang].loadError, true)
              }
            },
          )
        })
      }
      reader.readAsText(fileInput.files[0])
    })
  })

  document.querySelectorAll(".copy-link").forEach((button) => {
    button.addEventListener("click", copyLinkHandler)
  })
}

function updateDownloadList(networkUrls) {
  const downloadList = document.getElementById("downloadList")
  downloadList.innerHTML = ""

  if (networkUrls.length === 0) {
    downloadList.setAttribute("data-empty-text", translations[currentLang].noDownloads)
    return
  }

  // Sort URLs: .ts and .m3u8 first, then others, maintaining chronological order within groups
  const sortedUrls = networkUrls.slice().sort((a, b) => {
    const aIsPriority = a.url.includes(".ts") || a.url.includes(".m3u8")
    const bIsPriority = b.url.includes(".ts") || b.url.includes(".m3u8")

    if (aIsPriority && !bIsPriority) return -1 // a comes first
    if (!aIsPriority && bIsPriority) return 1 // b comes first
    return b.timestamp - a.timestamp // Within same group, newest first
  })

  sortedUrls.forEach((entry, index) => {
    const div = document.createElement("div")
    div.className = "download-item"
    div.innerHTML = `
      <span>${entry.url.split("/").pop().substring(0, 20)}... (${new Date(entry.timestamp).toLocaleTimeString()})</span>
      <div class="download-buttons">
        <button class="copy-link" data-network-index="${index}">${translations[currentLang].copyLink}</button>
      </div>
    `
    downloadList.appendChild(div)
  })

  document.querySelectorAll(".copy-link").forEach((button) => {
    button.removeEventListener("click", copyLinkHandler) // Remove previous listeners
    button.addEventListener("click", () => {
      const networkIndex = Number.parseInt(button.dataset.networkIndex)
      const url = sortedUrls[networkIndex]?.url
      if (url) {
        navigator.clipboard
          .writeText(url)
          .then(() => showMessage(translations[currentLang].linkCopied))
          .catch(() => showMessage(translations[currentLang].copyFailed, true))
      } else {
        showMessage(translations[currentLang].noLinkFound, true)
      }
    })
  })
}

function copyLinkHandler(event) {
  const button = event.target
  const index = button.dataset.index ? Number.parseInt(button.dataset.index) : null

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (index !== null) {
      // Copy link from video element
      chrome.tabs.sendMessage(
        tabs[0].id,
        {
          action: "getVideoLink",
          videoIndex: index,
        },
        (response) => {
          if (response?.link) {
            navigator.clipboard
              .writeText(response.link)
              .then(() => showMessage(translations[currentLang].linkCopied))
              .catch(() => showMessage(translations[currentLang].copyFailed, true))
          } else {
            showMessage(translations[currentLang].noLinkFound, true)
          }
        },
      )
    }
  })
}

function applySettings(videoIndex) {
  const settings = {
    position: document.getElementById("subtitlePosition").value,
    customOffset: Number.parseInt(document.getElementById("customOffset").value) || 0,
    font: document.getElementById("subtitleFont").value,
    size: Number.parseInt(document.getElementById("subtitleSize").value) || 16,
    color: document.getElementById("subtitleColor").value,
    bgColor: document.getElementById("subtitleBgColor").value,
    bgOpacity: Number.parseFloat(document.getElementById("subtitleBgOpacity").value) || 0.7,
  }

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(
      tabs[0].id,
      {
        action: "updateSubtitleSettings",
        videoIndex: videoIndex,
        settings: settings,
      },
      (response) => {
        if (response?.success) {
          showMessage(translations[currentLang].settingsApplied)
        } else {
          showMessage(translations[currentLang].settingsError, true)
        }
      },
    )
  })
}

// Function to update UI language
function updateLanguage(lang) {
  currentLang = lang
  document.documentElement.setAttribute("lang", lang)
  document.documentElement.setAttribute("dir", lang === "fa" ? "rtl" : "ltr")

  // Update all text elements
  document.getElementById("title").textContent = translations[lang].title
  document.getElementById("refreshText").textContent = translations[lang].refresh
  document.getElementById("srtLabel").textContent = translations[lang].selectSrt
  document.getElementById("videosTabText").textContent = translations[lang].videos
  document.getElementById("downloadsTabText").textContent = translations[lang].downloadLinks
  document.getElementById("settingsTitle").textContent = translations[lang].settings
  document.getElementById("positionLabel").textContent = translations[lang].position + ":"
  document.getElementById("posBottom").textContent = translations[lang].bottom
  document.getElementById("posMiddle").textContent = translations[lang].middle
  document.getElementById("posTop").textContent = translations[lang].top
  document.getElementById("posCustom").textContent = translations[lang].custom
  document.getElementById("customOffset").placeholder = translations[lang].customOffsetPlaceholder
  document.getElementById("fontLabel").textContent = translations[lang].font + ":"
  document.getElementById("sizeLabel").textContent = translations[lang].size + ":"
  document.getElementById("colorLabel").textContent = translations[lang].textColor + ":"
  document.getElementById("bgColorLabel").textContent = translations[lang].bgColor + ":"
  document.getElementById("opacityLabel").textContent = translations[lang].bgOpacity + ":"
  document.getElementById("delayLabel").textContent = translations[lang].delay + ":"
  document.getElementById("applySettingsText").textContent = translations[lang].applySettings
  document.getElementById("togglePiPText").textContent = translations[lang].togglePiP
  document.getElementById("clearSubtitlesText").textContent = translations[lang].clearSubtitles

  // Update data-empty-text attributes
  document.getElementById("videoList").setAttribute("data-empty-text", translations[lang].noVideos)
  document.getElementById("downloadList").setAttribute("data-empty-text", translations[lang].noDownloads)

  // Refresh video and download lists to update their text
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (videoResponse) => {
      const videos = videoResponse?.videos || []
      updateVideoList(videos)
    })

    const pageKey = `savedVideoUrls_${tabs[0].url}`
    chrome.storage.sync.get([pageKey], (result) => {
      const savedUrls = result[pageKey] || []
      updateDownloadList(savedUrls)
    })
  })
}

document.addEventListener("DOMContentLoaded", () => {
  // Set default language to Farsi
  updateLanguage("fa")

  // Language switcher
  document.getElementById("langFa").addEventListener("click", () => {
    document.getElementById("langFa").classList.add("active")
    document.getElementById("langEn").classList.remove("active")
    updateLanguage("fa")
  })

  document.getElementById("langEn").addEventListener("click", () => {
    document.getElementById("langFa").classList.remove("active")
    document.getElementById("langEn").classList.add("active")
    updateLanguage("en")
  })

  // Tab switching logic
  const videoTab = document.getElementById("videoTab")
  const downloadTab = document.getElementById("downloadTab")
  const videoTabContent = document.getElementById("videoTabContent")
  const downloadTabContent = document.getElementById("downloadTabContent")

  videoTab.addEventListener("click", () => {
    videoTab.classList.add("active")
    downloadTab.classList.remove("active")
    videoTabContent.classList.add("active")
    downloadTabContent.classList.remove("active")
  })

  downloadTab.addEventListener("click", () => {
    videoTab.classList.remove("active")
    downloadTab.classList.add("active")
    videoTabContent.classList.remove("active")
    downloadTabContent.classList.add("active")
  })

  // File input handling
  document.getElementById("srtFile").addEventListener("change", (e) => {
    const fileName = e.target.files[0]?.name
    if (fileName) {
      document.getElementById("selectedFileName").textContent = translations[currentLang].fileSelected + fileName
    } else {
      document.getElementById("selectedFileName").textContent = ""
    }
  })

  // Range input value display
  document.getElementById("subtitleBgOpacity").addEventListener("input", (e) => {
    document.getElementById("opacityValue").textContent = e.target.value
  })

  // Add this to the DOMContentLoaded event listener, after the opacity slider event listener
  // Range input value display for font size
  document.getElementById("subtitleSize").addEventListener("input", (e) => {
    document.getElementById("sizeValue").textContent = e.target.value
  })

  // Position dropdown change
  document.getElementById("subtitlePosition").addEventListener("change", (e) => {
    document.getElementById("customOffset").style.display = e.target.value === "custom" ? "block" : "none"
  })

  // Automatically detect videos and load saved network URLs for current page
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const pageKey = `savedVideoUrls_${tabs[0].url}`
    chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (videoResponse) => {
      const videos = videoResponse?.videos || []
      updateVideoList(videos)
    })
    chrome.storage.sync.get([pageKey], (result) => {
      const savedUrls = result[pageKey] || []
      updateDownloadList(savedUrls)
    })
  })

  // Manual refresh/search functionality
  document.getElementById("searchVideos").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const pageKey = `savedVideoUrls_${tabs[0].url}`
      chrome.storage.sync.set({ [pageKey]: [] }, () => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getVideos" }, (videoResponse) => {
          const videos = videoResponse?.videos || []
          updateVideoList(videos)
          updateDownloadList([]) // Clear the display immediately
          showMessage(translations[currentLang].videosRefreshed)
        })
      })
    })
  })

  // Apply settings button
  document.getElementById("applySettings").addEventListener("click", () => {
    const videoIndex = document.querySelector(".add-subtitle[data-index]:not([disabled])")?.dataset.index
    if (videoIndex !== undefined) {
      applySettings(Number.parseInt(videoIndex))
    } else {
      showMessage(translations[currentLang].loadSubtitlesFirst, true)
    }
  })

  // Toggle PiP button
  document.getElementById("togglePiP").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "togglePiP" })
    })
  })

  // Clear subtitles button
  document.getElementById("clearSubtitles").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, { action: "clearSubtitles" }, () => {
        showMessage(translations[currentLang].subtitlesCleared)
        document.getElementById("togglePiP").disabled = true
      })
    })
  })
})

