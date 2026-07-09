# How to Run ZenScreen

Follow these steps to run the ZenScreen Web App and Server locally.

## Prerequisites
1. **Node.js** (v18 or higher recommended)
2. **npm** (Node Package Manager)
3. **Android Studio** (If you want to run the Android app via an emulator or device)
4. A **Google Gemini API Key** (Optional, for AI features)

## 1. Start the Backend Server

1. Open your terminal or command prompt.
2. Navigate to the `server` directory:
   ```bash
   cd server
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Configure the environment variables:
   - Create a file named `.env` in the `server` folder.
   - Add the following lines (replace with your Gemini API key if you have one):
     ```env
     PORT=3001
     JWT_SECRET=super_secret_jwt_key
     GEMINI_API_KEY=your_gemini_api_key_here
     ```
5. Start the server:
   ```bash
   npm start
   ```
   *The server will start on `http://localhost:3001` and will serve the frontend automatically.*

## 2. Run the Web Application

Since the backend server serves the frontend statically, you only need to run the server.
1. Open your web browser.
2. Navigate to: [http://localhost:3001](http://localhost:3001) or [http://localhost:3001/app.html](http://localhost:3001/app.html)

*(Alternatively, you can run the root directory batch script `run_web_app.bat` if you are on Windows, which handles this automatically).*

## 3. Run the Android App (via Capacitor)

To run the native Android application which includes background screen tracking:

1. Open a new terminal in the root directory of the project (`digi well being app`).
2. Install root dependencies:
   ```bash
   npm install
   ```
3. Sync the web code to the Android project:
   ```bash
   npm run cap:sync
   ```
4. Open the project in Android Studio:
   ```bash
   npm run cap:android
   ```
   *(Or manually open the `android` folder in Android Studio).*
5. In Android Studio, wait for Gradle to finish syncing.
6. Connect an Android device (or start an emulator) and click the **Run** (Play) button.

> **Note:** To test the screen time tracking and blocking functionality, you MUST run the app on a real Android device or emulator, as web browsers cannot access native Android usage stats. Make sure your phone and PC are on the same Wi-Fi network so the app can talk to the local backend.
