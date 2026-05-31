{
  "use": {
    "baseURL": "http://192.168.1.111:3001",
    "screenshot": "only-on-failure",
    "video": "retain-on-failure",
    "trace": "on-first-retry"
  },
  "webServer": {
    "command": "cd server && npm start",
    "url": "http://192.168.1.111:3001",
    "reuseExistingServer": false
  }
}
