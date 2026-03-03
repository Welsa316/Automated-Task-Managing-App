const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;
const isDev = process.env.NODE_ENV === 'development';
const BACKEND_PORT = 3001;

function startBackend() {
  const backendDir = path.join(__dirname, '..', 'backend');
  backendProcess = spawn('node', ['dist/index.js'], {
    cwd: backendDir,
    env: { ...process.env, PORT: String(BACKEND_PORT), NODE_ENV: 'production' },
    stdio: 'pipe',
  });
  backendProcess.stdout?.on('data', (d) => console.log(`[backend] ${d}`));
  backendProcess.stderr?.on('data', (d) => console.error(`[backend] ${d}`));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 800, minHeight: 600,
    titleBarStyle: 'hiddenInset', backgroundColor: '#fafafa',
    webPreferences: { nodeIntegration: false, contextIsolation: true, preload: path.join(__dirname, 'preload.js') },
  });

  const url = isDev ? 'http://localhost:5173' : `http://localhost:${BACKEND_PORT}`;
  let retries = 0;
  function tryLoad() {
    fetch(url).then(() => mainWindow.loadURL(url)).catch(() => {
      if (++retries < 30) setTimeout(tryLoad, 500);
      else mainWindow.loadURL('data:text/html,<h2 style="font-family:system-ui;padding:40px;color:#666">Failed to connect to backend.</h2>');
    });
  }
  tryLoad();

  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  if (!isDev) startBackend();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (backendProcess) backendProcess.kill(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', () => { if (backendProcess) backendProcess.kill(); });
