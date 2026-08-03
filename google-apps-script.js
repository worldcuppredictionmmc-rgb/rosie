/**
 * Google Apps Script endpoint for this website.
 *
 * 1. Create a Google Sheet and copy its ID from the URL.
 * 2. Open Extensions > Apps Script, replace the starter code with this file.
 * 3. Add the Sheet ID below, save, then Deploy > New deployment > Web app.
 * 4. Set access to "Anyone" and copy the /exec URL into app.js.
 */
const SPREADSHEET_ID = "16FVjXb6FNOettgza5_OhcrTR1VEspKzB5L9nd-slvRM";
const SHEET_NAME = "Responses";

function doPost(event) {
  // Accept both website form data and JSON, so this endpoint is easy to test.
  const data = Object.keys(event.parameter || {}).length
    ? event.parameter
    : JSON.parse(event.postData.contents || "{}");
  const sheet = getResponseSheet_();
  sheet.appendRow([
    data.response || "UNKNOWN",
    data.date || "",
    data.time || "",
    new Date() // Google Apps Script server timestamp
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput("Response endpoint is running.");
}

function getResponseSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.appendRow(["Response", "Date", "Time", "Server timestamp"]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
