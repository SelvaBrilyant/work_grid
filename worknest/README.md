# WorkNest - Multi-Tenant Corporate Chat Application

A production-ready, real-time chat application similar to Slack or Microsoft Teams, built with a modern tech stack and enterprise-grade architecture.

## 🚀 Features

### Core Features
- **Multi-tenant Architecture**: Complete data isolation per organization via subdomain
- **Real-time Messaging**: Instant message delivery using Socket.IO
- **Channel System**: Public, private, and direct message channels
- **User Management**: Role-based access control (Admin/Employee)
- **Typing Indicators**: See when others are typing
- **Online Presence**: Track user online/offline status
- **Message Reactions**: React to messages with emojis
- **Reply Threads**: Reply to specific messages

### Security Features
- JWT-based authentication
- Organization-scoped data access
- Input sanitization (XSS protection)
- Rate limiting
- CORS configuration

## 🛠 Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development
- **TailwindCSS** for styling
- **shadcn/ui** for UI components
- **Zustand** for state management
- **Socket.IO Client** for real-time communication
- **React Router** for navigation

### Backend
- **Node.js** with Express.js
- **TypeScript** for type safety
- **MongoDB** with Mongoose ODM
- **Socket.IO** for WebSocket connections
- **JWT** for authentication
- **bcrypt** for password hashing

## 📁 Project Structure

```
worknest/
├── backend/
│   ├── src/
│   │   ├── config/         # Database & Socket configuration
│   │   ├── middlewares/    # Auth & Org middleware
│   │   ├── models/         # Mongoose models
│   │   ├── routes/         # Express routes
│   │   ├── sockets/        # Socket.IO handlers
│   │   ├── types/          # TypeScript types
│   │   └── server.ts       # Main server file
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── lib/            # Utilities & API
│   │   ├── pages/          # Page components
│   │   ├── store/          # Zustand stores
│   │   └── App.tsx         # Main app component
│   └── package.json
└── package.json            # Root scripts
```

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. **Clone and install dependencies:**
```bash
cd worknest
npm run install:all
```

2. **Configure environment:**
```bash
# Backend (.env file is pre-configured for development)
cd backend
# Update MONGODB_URI if needed
```

3. **Seed the database:**
```bash
npm run seed
```

4. **Start the application:**
```bash
npm run dev
```

This will start:
- Backend on http://localhost:5000
- Frontend on http://localhost:5173

### Demo Credentials

After seeding, you can login with these credentials:

| Organization | Email | Password |
|-------------|-------|----------|
| zoho.worknest.com | admin@zoho.com | password123 |
| infosys.worknest.com | admin@infosys.com | password123 |
| techstart.worknest.com | admin@techstart.com | password123 |

Other demo users: john@[org].com, sarah@[org].com, mike@[org].com

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register new organization
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/invite` - Invite user (Admin)
- `POST /api/auth/activate` - Activate invited user

### Channels
- `GET /api/channels` - List user's channels
- `POST /api/channels` - Create channel (Admin)
- `GET /api/channels/:id` - Get channel details
- `DELETE /api/channels/:id` - Delete channel (Admin)
- `POST /api/channels/dm` - Create/get DM channel

### Messages
- `GET /api/messages/:channelId` - Get channel messages
- `POST /api/messages/:channelId` - Send message
- `PUT /api/messages/:id` - Edit message
- `DELETE /api/messages/:id` - Delete message

### Users
- `GET /api/users` - List organization users
- `GET /api/users/:id` - Get user details
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Block user (Admin)

## 🔌 Socket Events

### Client → Server
- `join-channel` - Join a channel room
- `leave-channel` - Leave a channel room
- `send-message` - Send a message
- `typing` - Start typing indicator
- `stop-typing` - Stop typing indicator
- `react` - Add/remove reaction
- `mark-read` - Mark messages as read

### Server → Client
- `receive-message` - New message received
- `typing` - User is typing
- `stop-typing` - User stopped typing
- `user-online` - User came online
- `user-offline` - User went offline
- `online-users` - List of online users
- `reaction-updated` - Message reaction changed

## 🔐 Multi-tenancy

Each organization operates on its own subdomain:
- `zoho.worknest.com`
- `infosys.worknest.com`
- `techstart.worknest.com`

For local development, use the `X-Organization-Subdomain` header or `?org=subdomain` query parameter.

## 📊 Database Schema

### Collections
- **Organization** - Company/tenant data
- **User** - User accounts (scoped by org)
- **Channel** - Chat channels
- **ChannelMember** - Channel memberships
- **Message** - Chat messages

All collections are indexed with `organizationId` for tenant isolation and query performance.

## 🎨 UI/UX Features

- **Dark Mode** - Default dark theme
- **Responsive Design** - Works on desktop and mobile
- **Real-time Updates** - Instant message delivery
- **Typing Indicators** - See who's typing
- **Online Status** - Green dot for online users
- **Unread Counts** - Badge showing unread messages
- **Message Grouping** - Consecutive messages grouped by sender
- **Smooth Animations** - Polished transitions

## 🔧 Configuration

### Environment Variables (Backend)

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 5000 |
| MONGODB_URI | MongoDB connection string | mongodb://localhost:27017/worknest |
| JWT_SECRET | JWT signing secret | (required) |
| JWT_EXPIRES_IN | Token expiration | 7d |
| ALLOWED_ORIGINS | CORS origins | http://localhost:5173 |

## 📝 License

MIT License

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

Built with ❤️ using React, Node.js, and MongoDB
