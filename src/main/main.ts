const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  dialog,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

function createMainWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false, // Allow loading local files
    },
    icon: path.join(__dirname, "../assets/icons/app-icon.png"),
    show: false, // Don't show until ready-to-show
  });

  // Load the main HTML file
  mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));

  // Show window when ready to prevent visual flash
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // Handle window closed
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Development tools - commented out for now
  // mainWindow.webContents.openDevTools();
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  createMainWindow();
  createMenu();

  app.on("activate", () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [
        {
          label: "Open PDF...",
          accelerator: "CmdOrCtrl+O",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [{ name: "PDF Files", extensions: ["pdf"] }],
              properties: ["openFile"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send("open-pdf", result.filePaths[0]);
            }
          },
        },
        {
          label: "Create PDF from Images...",
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              filters: [
                { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
              ],
              properties: ["openFiles", "multiSelections"],
            });

            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send(
                "create-pdf-from-images",
                result.filePaths
              );
            }
          },
        },
        { type: "separator" },
        {
          label: "Export as Images...",
          click: () => {
            mainWindow.webContents.send("export-as-images");
          },
        },
        {
          label: "Extract Text...",
          click: () => {
            mainWindow.webContents.send("extract-text");
          },
        },
        { type: "separator" },
        {
          label: "Print",
          accelerator: "CmdOrCtrl+P",
          click: () => {
            mainWindow.webContents.send("print-pdf");
          },
        },
        { type: "separator" },
        {
          label: "Exit",
          accelerator: process.platform === "darwin" ? "Cmd+Q" : "Ctrl+Q",
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "actualSize" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Highlighter",
          accelerator: "CmdOrCtrl+H",
          click: () => {
            mainWindow.webContents.send("tool-selected", "highlighter");
          },
        },
        {
          label: "Comment",
          accelerator: "CmdOrCtrl+M",
          click: () => {
            mainWindow.webContents.send("tool-selected", "comment");
          },
        },
        {
          label: "Signature",
          accelerator: "CmdOrCtrl+S",
          click: () => {
            mainWindow.webContents.send("tool-selected", "signature");
          },
        },
        {
          label: "Stamp",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            mainWindow.webContents.send("tool-selected", "stamp");
          },
        },
      ],
    },
    {
      label: "Window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "About PDF Reader",
              message: "PDF Reader v1.0.0",
              detail:
                "A feature-rich PDF reader and editor built with Electron.",
            });
          },
        },
        {
          label: "License",
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: "info",
              title: "GPL-3.0 License",
              message: "Copyright (C) 2025 Beatrix CHAN",
              detail:
                "This program is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or any later version.\n\nThis program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.\n\nYou should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.",
            });
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers
ipcMain.handle("show-save-dialog", async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle("show-open-dialog", async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle("read-file", async (event, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, data: data.toString("base64") };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("write-file", async (event, filePath, data) => {
  try {
    const buffer = Buffer.from(data, "base64");
    fs.writeFileSync(filePath, buffer);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("show-message-box", async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

// Handle app protocol for file associations (future enhancement)
app.setAsDefaultProtocolClient("pdf-reader");
