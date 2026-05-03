{
  "use": {
    "baseURL": "http://localhost:3001",
    "screenshot": "only-on-failure",
    "video": "retain-on-failure",
    "trace": "on-first-retry"
  },
  "webServer": {
    "command": "cd server && npm start",
    "url": "http://localhost:3001",
    "reuseExistingServer": false
  }
}
