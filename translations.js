const translations = {
  fa: {
    title: "زیرنویس ویدیو",
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
  },
}

let currentLanguage = "fa" // Default language is Farsi

// Check if chrome is defined, if not, define it as an empty object
if (typeof chrome === "undefined") {
  chrome = {}
}

function setLanguage(lang) {
  currentLanguage = lang
  document.documentElement.lang = lang
  document.documentElement.dir = lang === "fa" ? "rtl" : "ltr"

  // Update title
  document.title = translations[lang].title
  document.getElementById("title").textContent = translations[lang].title

  // Update all elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.getAttribute("data-i18n")
    if (translations[lang][key]) {
      if (element.tagName === "INPUT" && element.type === "placeholder") {
        element.placeholder = translations[lang][key]
      } else {
        element.textContent = translations[lang][key]
      }
    }
  })

  // Update custom placeholder
  const customOffset = document.getElementById("customOffset")
  if (customOffset) {
    customOffset.placeholder = translations[lang].customOffsetPlaceholder
  }

  // Save language preference
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.set({ language: lang })
  }
}

// Initialize language from saved preference or default to Farsi
document.addEventListener("DOMContentLoaded", () => {
  if (typeof chrome !== "undefined" && chrome.storage) {
    chrome.storage.sync.get(["language"], (result) => {
      const savedLanguage = result.language || "fa"
      setLanguage(savedLanguage)

      // Set active class on language button
      document.getElementById("langFa").classList.toggle("active", savedLanguage === "fa")
      document.getElementById("langEn").classList.toggle("active", savedLanguage === "en")
    })
  } else {
    setLanguage("fa")
  }

  // Language switcher event listeners
  document.getElementById("langFa").addEventListener("click", () => {
    setLanguage("fa")
    document.getElementById("langFa").classList.add("active")
    document.getElementById("langEn").classList.remove("active")
  })

  document.getElementById("langEn").addEventListener("click", () => {
    setLanguage("en")
    document.getElementById("langFa").classList.remove("active")
    document.getElementById("langEn").classList.add("active")
  })
})

// Function to get translated text
function t(key) {
  return translations[currentLanguage][key] || key
}

