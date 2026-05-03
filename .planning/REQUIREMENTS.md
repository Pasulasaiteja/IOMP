# Project Requirements

## 1. Authentication
- **User Registration**: Name, Email (unique), Password (hashed).
- **User Login**: Email/Password with JWT issuance.
- **Profile Management**: Update name/email, change password.

## 2. Dashboard (Home)
- **Total Time**: Sum of app usage for current day.
- **Weekly Comparison**: Bar chart comparing current week to previous week.
- **AI Insights**: Top 3 observations based on recent data trends.
- **Progress Ring**: Percentage of daily goal used.

## 3. Safety & Limits
- **App Limits**: Set individual minute limits per app.
- **Focus Mode**:
    - Select duration (15, 30, 60, 120, or custom).
    - Countdown timer UI.
    - Blocking simulation (Visual feedback).
- **Over Limit UI**: Visual indicators for apps exceeding limits.

## 4. AI Coach
- **Comparison Views**: Toggle between Day, Week, and Month trends.
- **Interactive Chat**: Chat with Gemini Pro regarding screen habits.
- **Context Awareness**: AI should know the user's recent usage data.

## 5. Technical Requirements
- **Performance**: Instant tab switching, smooth animations.
- **Storage**: All user data must persist in SQLite.
- **Responsiveness**: Premium mobile-first layout (390px width target).
