# Real-Time Typing Chat System

A modern real-time chat application with live typing indicators and Gmail authentication. Users can see each other's messages as they type, making conversations more dynamic and engaging.

## Features

- **Real-Time Typing**: See messages as they're being typed
- **Gmail Authentication**: Secure login using Google OAuth
- **Persistent Chat History**: Messages are stored in MongoDB
- **Modern UI**: Clean and responsive design with animations
- **User Profiles**: Display user avatars and names from Google profiles
- **Typing Indicators**: Show when other users are typing
- **Message History**: Access previous chat messages

## Technologies Used

- **Backend**:
  - Node.js
  - Express.js
  - Socket.io
  - MongoDB
  - Passport.js (Google OAuth)

- **Frontend**:
  - HTML5
  - CSS3
  - JavaScript
  - Socket.io Client

## Prerequisites

Before running this application, make sure you have:

1. Node.js and npm installed
2. MongoDB installed and running
3. Google OAuth credentials (Client ID and Client Secret)

## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd real-time-chat
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   MONGODB_URI=your_mongodb_uri
   GOOGLE_CLIENT_ID=your_google_client_id
   GOOGLE_CLIENT_SECRET=your_google_client_secret
   SESSION_SECRET=your_session_secret
   PORT=3000
   ```

4. Start the server:
   ```bash
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Setting up Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to Credentials
5. Create OAuth 2.0 Client ID
6. Add authorized redirect URI: `http://localhost:3000/auth/google/callback`
7. Copy the Client ID and Client Secret to your `.env` file

## Usage

1. Visit the application URL
2. Click "Sign in with Google"
3. Grant the necessary permissions
4. Start chatting!
- Type messages to see them appear in real-time
- Send messages by clicking the send button or pressing Enter
- View typing indicators when others are typing
- Your messages will be saved and loaded when you return

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details
