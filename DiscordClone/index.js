// const { app, BrowserWindow } = require('electron/main');
// const path = require('node:path');

// function createWindow() {
//   const win = new BrowserWindow({
//     minWidth: 700,
//     minHeight: 700,
//     webPreferences: {
//       preload: path.join(__dirname, 'preload.js'),
//       nodeIntegration: true,
//     },
//   });

//   win.loadFile('./Pages/LogIn.html');
//   // win.removeMenu();
// }

// app.whenReady().then(() => {
//   createWindow();

//   app.on('activate', () => {
//     if (BrowserWindow.getAllWindows().length === 0) {
//       createWindow();
//     }
//   });
// });

// app.on('window-all-closed', () => {
//   if (process.platform !== 'darwin') {
//     app.quit();
//   }
// });
