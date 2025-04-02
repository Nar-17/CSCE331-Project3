function onOpen() {
  DocumentApp.getUi()
    .createAddonMenu()
    .addItem("Open Sidebar", "showSidebar")
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile("sidebar")
    .setTitle("Sidebar");
  DocumentApp.getUi().showSidebar(html);
}

function onInstall(e) {
  onOpen(e);
}
