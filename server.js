require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('./models/User');
const Message = require('./models/Message');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

// Connect to MongoDB first
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB Connected successfully');
})
.catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1); // Exit if MongoDB connection fails
});

// Session configuration
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions',
        ttl: 24 * 60 * 60 // 1 day
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Logging for session and user
app.use((req, res, next) => {
    console.log('Session:', req.session);
    console.log('User:', req.user);
    next();
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.SESSION_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

// CORS configuration for production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        const origin = req.headers.origin;
        if (origin === 'https://truerealchat.vercel.app') {
            res.header('Access-Control-Allow-Origin', origin);
            res.header('Access-Control-Allow-Credentials', true);
            res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
        }
        next();
    });
}

// Auth middleware
const ensureAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.xhr || req.headers.accept.indexOf('json') > -1) {
        res.status(401).json({ error: 'Not authenticated' });
    } else {
        res.redirect('/login');
    }
};

// Routes
app.get('/', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            res.sendFile(path.join(__dirname, 'public', 'chat.html'));
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error in root route:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/login', (req, res) => {
    try {
        if (req.isAuthenticated()) {
            res.redirect('/');
        } else {
            res.sendFile(path.join(__dirname, 'public', 'login.html'));
        }
    } catch (err) {
        console.error('Error in login route:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/chat', ensureAuth, (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'chat.html'));
    } catch (err) {
        console.error('Error in chat route:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Auth Routes
app.get('/auth/google', (req, res, next) => {
    console.log('Starting Google OAuth...');
    passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/auth/google/callback', (req, res, next) => {
    console.log('Google callback received');
    console.log('Session data:', req.session);
    console.log('User data before authentication:', req.user);
    passport.authenticate('google', {
        successRedirect: '/',
        failureRedirect: '/login',
        failureMessage: true
    })(req, res, next);
});

app.get('/api/user', ensureAuth, (req, res) => {
    try {
        res.json({
            id: req.user._id,
            displayName: req.user.displayName,
            avatar: req.user.avatar
        });
    } catch (err) {
        console.error('Error in user API:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

app.get('/logout', (req, res) => {
    try {
        req.logout((err) => {
            if (err) {
                console.error('Logout error:', err);
                return res.status(500).json({ error: 'Error during logout' });
            }
            req.session.destroy((err) => {
                if (err) {
                    console.error('Session destruction error:', err);
                }
                res.redirect('/login');
            });
        });
    } catch (err) {
        console.error('Error in logout:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// Socket.IO setup
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    path: '/socket.io',
    cors: {
        origin: process.env.NODE_ENV === 'production' 
            ? ['https://truerealchat.vercel.app']
            : ['http://localhost:8080'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Socket.IO middleware to access session data
io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
});

io.use((socket, next) => {
    try {
        const session = socket.request.session;
        if (session && session.passport && session.passport.user) {
            socket.user = session.passport.user;
            next();
        } else {
            next(new Error('Unauthorized'));
        }
    } catch (err) {
        console.error('Socket.IO auth error:', err);
        next(err);
    }
});

// Socket.IO event handlers
io.on('connection', async (socket) => {
    console.log('User connected:', socket.user);
    const user = socket.user;

    try {
        // Load previous messages
        const messages = await Message.find()
            .sort({ timestamp: -1 })
            .limit(50)
            .populate('sender')
            .exec();

        socket.emit('previousMessages', messages.reverse());
    } catch (err) {
        console.error('Error loading messages:', err);
        socket.emit('error', { message: 'Error loading messages' });
    }

    // Handle new messages
    socket.on('sendMessage', async (text) => {
        try {
            const message = new Message({
                text,
                sender: user,
                timestamp: new Date()
            });

            await message.save();
            const populatedMessage = await message.populate('sender');

            io.emit('newMessage', populatedMessage);
        } catch (err) {
            console.error('Error saving message:', err);
            socket.emit('error', { message: 'Error saving message' });
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
        console.log('User disconnected:', socket.user);
    });
});

// Port configuration
const PORT = process.env.PORT || 8080;

if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV}`);
    });
}

// Export for Vercel
module.exports = server;
