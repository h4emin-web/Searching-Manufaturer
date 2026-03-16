const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron')
const path = require('path')

let mainWindow
let tray

const isDev = process.env.NODE_ENV === 'development'

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    title: '업무 관리',
    show: false,
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('close', (event) => {
    event.preventDefault()
    mainWindow.hide()
  })
}

function createTray() {
  // 기본 아이콘 (없으면 빈 이미지)
  let icon
  try {
    icon = nativeImage.createFromPath(path.join(__dirname, '../../public/icon.ico'))
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty()
    }
  } catch {
    icon = nativeImage.createEmpty()
  }

  tray = new Tray(icon)
  tray.setToolTip('업무 관리')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '열기',
      click: () => {
        mainWindow.show()
        mainWindow.focus()
      },
    },
    { type: 'separator' },
    {
      label: '종료',
      click: () => {
        app.exit(0)
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

app.whenReady().then(() => {
  // Windows 시작 시 자동 실행 등록
  app.setLoginItemSettings({
    openAtLogin: true,
    path: process.execPath,
  })

  createWindow()
  createTray()
})

app.on('window-all-closed', (e) => {
  e.preventDefault()
})
