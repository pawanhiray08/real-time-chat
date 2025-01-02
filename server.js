require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const mongoose = require('mongoose');
const User = require('./models/User');
const Message = require('./models/Message');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');

const app = express();

// Session configuration
const sessionMiddleware = session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);
app.use(express.static('public'));

// Passport config
require('./config/passport');
app.use(passport.initialize());
app.use(passport.session());

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => {
    console.log('MongoDB Connected successfully');
})
.catch(err => {
    console.error('MongoDB Connection Error:', err);
});

// Auth Routes
app.get('/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
    passport.authenticate('google', { failureRedirect: '/login' }),
    (req, res) => {
        res.redirect('/');
    }
);

app.get('/api/user', (req, res) => {
    if (req.user) {
        res.json({
            id: req.user._id,
            displayName: req.user.displayName,
            avatar: req.user.avatar
        });
    } else {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        res.redirect('/');
    });
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
    const session = socket.request.session;
    if (session && session.passport && session.passport.user) {
        socket.user = session.passport.user;
        next();
    } else {
        next(new Error('Unauthorized'));
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
