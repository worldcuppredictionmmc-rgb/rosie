// Add your Firebase web app configuration here before publishing.
// Create this in Firebase Console > Project settings > Your apps > Web app.
const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

// Paste your deployed Google Apps Script Web App URL between these quotes.
// Example: "https://script.google.com/macros/s/AKfycb.../exec"
const googleSheetsWebAppUrl = "https://script.google.com/macros/s/AKfycbwlSP68j6Nsv0dqB1txCZ4uRUTvAH7w2WhR5NTJSJZBBW5YtVDIBNVB8JYnuXbrD9MZ/exec";

// Keep this false to prevent every response from being stored anywhere.
const saveResponses = false;

// Add your own MP3 file inside assets/, then write its filename here.
// Example: "assets/message.mp3". Leave blank to keep the built-in chime.
const customAudioUrl = "audio.mp3";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getFirestore, addDoc, collection, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const $ = (selector) => document.querySelector(selector);
const screens = { intro: $("#intro"), question: $("#question"), final: $("#final") };
const modal = $("#confirmation-modal");
let lastFocusedElement;
let audioContext;
let activeOscillators = [];
let audioStopTimer;
const customAudio = customAudioUrl ? new Audio(customAudioUrl) : null;

// Firebase is initialized only when valid project details are supplied.
const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
let db = null;
if (hasFirebaseConfig) {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
}

function goToScreen(name) {
  const nextScreen = screens[name];
  Object.values(screens).forEach((screen) => {
    if (screen === nextScreen) return;
    screen.classList.remove("screen--active");
    screen.hidden = true;
  });
  nextScreen.hidden = false;
  nextScreen.classList.remove("screen--active");
  void nextScreen.offsetWidth; // Restart the entry animation.
  nextScreen.classList.add("screen--active");
}

async function saveResponse(response) {
  if (!saveResponses) return;

  const now = new Date();
  const record = {
    response,
    date: [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-"),
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  };

  // Firestore adds a trusted server-side timestamp; local date and time aid quick reading.
  if (db) {
    try {
      await addDoc(collection(db, "responses"), { ...record, serverTimestamp: serverTimestamp() });
    } catch (error) {
      console.error("Could not save response to Firestore:", error);
    }
  } else {
    console.info("Firebase not configured. Response was not sent:", record);
  }

  // A hidden HTML form avoids CORS issues with Google Apps Script Web Apps.
  if (googleSheetsWebAppUrl) {
    try {
      sendToGoogleSheet(record);
    } catch (error) {
      console.error("Could not send response to Google Sheets:", error);
    }
  }
}

function sendToGoogleSheet(record) {
  const iframeName = "google-sheet-response-target";
  let target = document.querySelector(`iframe[name="${iframeName}"]`);
  if (!target) {
    target = document.createElement("iframe");
    target.name = iframeName;
    target.hidden = true;
    document.body.append(target);
  }

  const form = document.createElement("form");
  form.action = googleSheetsWebAppUrl;
  form.method = "POST";
  form.target = iframeName;
  form.hidden = true;
  Object.entries(record).forEach(([key, value]) => {
    const field = document.createElement("input");
    field.name = key;
    field.value = value;
    form.append(field);
  });
  document.body.append(form);
  form.submit();
  setTimeout(() => form.remove(), 1000);
}

function openModal() {
  lastFocusedElement = document.activeElement;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  $("#confirm-no-button").focus();
}

function closeModal() {
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  lastFocusedElement?.focus();
}

function stopAudio() {
  clearTimeout(audioStopTimer);
  activeOscillators.forEach((oscillator) => {
    try { oscillator.stop(); } catch { /* The note may have already ended. */ }
  });
  activeOscillators = [];
  if (customAudio) {
    customAudio.pause();
    customAudio.currentTime = 0;
  }
  $("#close-audio-button").hidden = true;
}

function playLoveChime() {
  stopAudio();
  $("#close-audio-button").hidden = false;

  // If a personal MP3 is configured, it replaces the default chime.
  if (customAudio) {
    customAudio.play().catch((error) => console.error("Could not play custom audio:", error));
    return;
  }
  audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
  audioContext.resume();

  // A short, original four-note chime keeps the page self-contained.
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const startAt = audioContext.currentTime + 0.05;
  notes.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const begins = startAt + index * 0.32;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, begins);
    gain.gain.setValueAtTime(0.0001, begins);
    gain.gain.exponentialRampToValueAtTime(0.16, begins + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, begins + 0.65);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start(begins);
    oscillator.stop(begins + 0.67);
    activeOscillators.push(oscillator);
  });
  audioStopTimer = setTimeout(stopAudio, 1900);
}

$("#open-button").addEventListener("click", () => goToScreen("question"));
$("#yes-button").addEventListener("click", async () => { await saveResponse("YES"); goToScreen("final"); });
$("#no-button").addEventListener("click", openModal);
$("#confirm-no-button").addEventListener("click", async () => { closeModal(); await saveResponse("NO_CONFIRMED"); goToScreen("final"); });
$("#cancel-no-button").addEventListener("click", async () => { closeModal(); await saveResponse("NO_CANCELLED"); goToScreen("final"); });
$("#play-audio-button").addEventListener("click", playLoveChime);
$("#close-audio-button").addEventListener("click", stopAudio);
customAudio?.addEventListener("ended", () => { $("#close-audio-button").hidden = true; });

modal.addEventListener("click", (event) => { if (event.target.matches("[data-close-modal]")) closeModal(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal.classList.contains("is-open")) closeModal(); });
