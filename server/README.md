# ZenScreen Backend Server

A Node.js/Express API backend for the ZenScreen digital well-being application. Provides user authentication, screen time tracking, app limits management, and AI-powered coaching through Google Gemini.

## Quick Start

### Prerequisites
- Node.js (v18+)
- npm
- Google Gemini API key (optional, for AI coaching features)

### Installation

1. **Install dependencies**
   ```bash
   cd server
   npm install
   ```

2. **Configure environment variables**
   
   Create a `.env` file in the `server/` directory:
   ```env
   JWT_SECRET=your-secret-key-change-this-in-production
   GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE
   PORT=3001
   ```

3. **Start the server**
   ```bash
   npm start
   ```
   
   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## API Endpoints

### Health Check
- **GET** `/health` - Server health status
  ```
  Response: {"status":"ZenScreen Server Online"}
  ```

### Authentication Routes (`/api/auth`)
- **POST** `/api/auth/register` - User registration
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```
  
- **POST** `/api/auth/login` - User login
  ```json
  {
    "email": "john@example.com",
    "password": "securepassword123"
  }
  ```

### Data Routes (`/api/data`) - Requires JWT Token
- **GET** `/api/data/summary` - Get screen time summary and user data
  ```
  Headers: Authorization: Bearer <jwt_token>
  ```

- **PUT** `/api/data/screentime` - Log screen time
  ```json
  {
    "appName": "Instagram",
    "minutes": 45,
    "date": "2026-04-29"
  }
  ```

### AI Coach Routes (`/api/ai`) - Requires JWT Token
- **POST** `/api/ai/chat` - Chat with AI Coach
  ```json
  {
    "messages": [
      {
        "role": "user",
        "content": "How can I reduce my screen time?"
      }
    ]
  }
  ```

## Project Structure

```
server/
├── server.js              # Express app setup and routes
├── db.js                  # SQLite database initialization & helpers
├── package.json           # Dependencies and scripts
├── .env                   # Environment variables (create this)
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── data.js           # Screen time & preferences endpoints
│   └── ai.js             # AI Coach endpoints
└── zenscreen.db          # SQLite database (auto-created)
```

## Database Schema

### Users Table
- `id` (INTEGER PRIMARY KEY)
- `name` (TEXT)
- `email` (TEXT UNIQUE)
- `password` (TEXT - hashed with bcrypt)
- `daily_goal` (INTEGER - default 360 mins)
- `streak` (INTEGER)
- `created_at` (TEXT)

### Screen Time Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (FOREIGN KEY)
- `date` (TEXT)
- `app_name` (TEXT)
- `minutes` (INTEGER)

### App Limits Table
- `id` (INTEGER PRIMARY KEY)
- `user_id` (FOREIGN KEY)
- `app_name` (TEXT)
- `limit_mins` (INTEGER)

### Preferences Table
- `user_id` (FOREIGN KEY PRIMARY KEY)
- `notifications` (INTEGER - 0/1)
- `bedtime_mode` (INTEGER - 0/1)
- `weekly_report` (INTEGER - 0/1)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret key for JWT signing | Required |
| `GEMINI_API_KEY` | Google Gemini API key | Optional (AI features won't work without it) |
| `PORT` | Server port | 3001 |

## Technology Stack

- **Framework**: Express.js
- **Database**: SQLite (sql.js)
- **Authentication**: JWT with bcrypt
- **AI**: Google Gemini 1.5 Flash API
- **Request Parsing**: express.json()
- **Security**: CORS enabled, Password hashing with bcryptjs

## Development

### Available Scripts

```bash
# Start server
npm start

# Start with auto-reload (requires nodemon)
npm run dev

# List installed packages
npm list

# Check for vulnerabilities
npm audit
```

### Testing Endpoints

Use curl or Postman to test:

```bash
# Health check
curl http://localhost:3001/health

# Register user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "password": "TestPass123"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPass123"
  }'
```

## Known Issues & Limitations

1. **Gemini API Required**: AI Coach features require a valid Google Gemini API key
2. **Single Process**: Database uses in-memory operations with file persistence (not optimized for concurrent writes)
3. **No Rate Limiting**: Consider adding rate limiting for production use

## Future Enhancements

- [ ] Rate limiting middleware
- [ ] Input validation schema (Joi/Zod)
- [ ] Comprehensive error logging
- [ ] API documentation (Swagger/OpenAPI)
- [ ] Database migrations
- [ ] Unit & integration tests
- [ ] Docker containerization

## Support

For issues or questions, refer to the main project documentation in `.planning/`
