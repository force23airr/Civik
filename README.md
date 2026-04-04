# Civik

A community-driven dash cam platform where drivers can upload footage, report incidents, and alert others about dangerous driving, crime, and security concerns in real-time.

## Features

- **User Authentication** - Register and login with JWT-based authentication
- **Incident Reporting** - Upload dash cam videos/images and report incidents with location, type, and severity
- **Real-time Alerts** - Broadcast alerts to the community via WebSockets
- **Incident Browsing** - Filter and search incidents by type, severity, and status
- **User Profiles** - View submission history and statistics

## Tech Stack

**Frontend:**
- React 18
- Vite
- React Router
- Socket.io Client
- Axios

**Backend:**
- Node.js
- Express
- MongoDB with Mongoose
- JWT Authentication
- Socket.io
- Multer (file uploads)

## Prerequisites

- Node.js 18+
- MongoDB (local installation or MongoDB Atlas)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/force23airr/civik.git
   cd civik
   ```

2. Install dependencies:
   ```bash
   npm run install-all
   ```

3. Configure environment variables:

   Edit `server/.env` with your settings:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/civik
   JWT_SECRET=your_secret_key_here
   ```

4. Start MongoDB (if running locally)

5. Run the application:
   ```bash
   npm run dev
   ```

   This starts both the backend (port 5000) and frontend (port 5173).

## Project Structure

```
civik/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── context/        # Auth context provider
│   │   └── services/       # API and Socket.io services
│   └── package.json
├── server/                 # Express backend
│   ├── config/             # Database configuration
│   ├── controllers/        # Route handlers
│   ├── middleware/         # Auth and upload middleware
│   ├── models/             # Mongoose schemas
│   ├── routes/             # API routes
│   ├── uploads/            # Uploaded media files
│   └── package.json
└── package.json            # Root package with scripts
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Incidents
- `GET /api/incidents` - List incidents (with filters)
- `GET /api/incidents/:id` - Get single incident
- `POST /api/incidents` - Create incident (authenticated)
- `PUT /api/incidents/:id` - Update incident (owner only)
- `DELETE /api/incidents/:id` - Delete incident (owner only)

### Alerts
- `GET /api/alerts` - Get active alerts
- `POST /api/alerts` - Create alert (authenticated)
- `DELETE /api/alerts/:id` - Delete alert (owner only)

### Users
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update profile (owner only)

## License

MIT
