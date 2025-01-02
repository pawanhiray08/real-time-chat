require('dotenv').config();
const express = require('express');
const app = express();
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const http = require('http');
const io = require('socket.io')();
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
});

// Models
const User = require('./models/User');
const Message = require('./models/Message');

// Middleware
const { ensureAuth, ensureGuest } = require('./middleware/auth');

// Update Google OAuth callback URL based on environment
const isProduction = process.env.NODE_ENV === 'production';
const port = process.env.PORT || 8080;
const callbackURL = isProduction 
    ? 'https://your-render-app-name.onrender.com/auth/google/callback'
    : `http://localhost:${port}/auth/google/callback`;

// Passport config with dynamic callback URL
require('./config/passport')(passport, callbackURL);

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Sessions
app.use(sessionMiddleware);

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Port configuration
const PORT = process.env.PORT || 8080;

// Start server
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Socket.IO configuration
io.listen(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ['https://real-time-chat-pawanhiray08.koyeb.app'] 
            : ['http://localhost:8080'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket.IO middleware to access session data
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/health', (req, res) => {
    res.send('Server is running');
});

app.get('/chat', ensureAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// API Routes
app.get('/api/user', ensureAuth, (req, res) => {
    res.json({
        id: req.user._id,
        displayName: req.user.displayName,
        email: req.user.email,
        avatar: req.user.avatar
    });
});

// Auth routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/' }),
    (req, res) => {
        res.redirect('/chat');
    }
);

app.get('/auth/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
});

// Socket.IO connection handling
io.on('connection', async (socket) => {
    console.log('User connected:', socket.id);
    
    // Get user from session
    const user = socket.request.session?.passport?.user;
    if (!user) {
        console.log('No authenticated user for socket:', socket.id);
        return;
    }

    // Load previous messages
    try {
        const messages = await Message.find()
            .sort('-timestamp')
            .limit(50)
            .populate('sender', 'displayName avatar');
        socket.emit('previousMessages', messages.reverse());
    } catch (err) {
        console.error('Error loading messages:', err);
    }

    // Handle new message
    socket.on('sendMessage', async (messageText) => {
        try {
            const userDoc = await User.findById(user);
            const message = await Message.create({
                sender: user,
                text: messageText,
                timestamp: new Date()
            });
            
            const populatedMessage = await Message.findById(message._id)
                .populate('sender', 'displayName avatar');
            
            io.emit('newMessage', populatedMessage);
        } catch (err) {
            console.error('Error saving message:', err);
        }
    });

    // Handle typing status
    socket.on('typing', async (data) => {
        try {
            const userDoc = await User.findById(user);
            socket.broadcast.emit('userTyping', {
                userId: user,
                displayName: userDoc.displayName,
                avatar: userDoc.avatar,
                text: data.text,
                isTyping: true
            });
        } catch (err) {
            console.error('Error handling typing status:', err);
        }
    });

    socket.on('stopTyping', () => {
        socket.broadcast.emit('userTyping', {
            userId: user,
            isTyping: false,
            text: ''
        });
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

// Connect to MongoDB and start server
console.log('Attempting to connect to MongoDB...');
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 2000,
    retryWrites: true,
    w: 'majority',
    dbName: 'chatapp'
})
.then(() => {
    console.log('MongoDB Connected successfully');
})
.catch(err => {
    console.error('MongoDB Connection Error - Details:', err);
    if (err.name === 'MongoServerSelectionError') {
        console.log('\nTroubleshooting steps:');
        console.log('1. Check if your IP is whitelisted in MongoDB Atlas');
        console.log('2. Verify username and password are correct');
        console.log('3. Ensure MongoDB Atlas cluster is running');
        console.log('4. Check if there are any network restrictions');
    }
    process.exit(1);
});

// Handle MongoDB connection events
mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
});
