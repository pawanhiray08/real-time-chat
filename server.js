require('dotenv').config();
const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const mongoose = require('mongoose');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');

// Models
const User = require('./models/User');
const Message = require('./models/Message');

// Middleware
const { ensureAuth, ensureGuest } = require('./middleware/auth');

// Passport config
require('./config/passport')(passport);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('MongoDB Connected'))
.catch(err => console.error('MongoDB Connection Error:', err));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Sessions
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));

// Passport middleware
app.use(passport.initialize());
app.use(passport.session());

// Routes
app.get('/', ensureGuest, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/chat', ensureAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
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

// Socket.io connection handling
io.on('connection', async (socket) => {
    console.log('A user connected');
    
    // Attach user data to socket
    if (socket.request.session.passport) {
        const userId = socket.request.session.passport.user;
        const user = await User.findById(userId);
        socket.user = user;
    }

    // Send previous messages
    const messages = await Message.find()
        .populate('sender')
        .sort({ timestamp: -1 })
        .limit(50);
    socket.emit('previousMessages', messages.reverse());

    // Handle new messages
    socket.on('sendMessage', async (text) => {
        if (socket.user) {
            const message = new Message({
                sender: socket.user._id,
                text: text
            });
            await message.save();
            
            const populatedMessage = await message.populate('sender');
            io.emit('newMessage', populatedMessage);
        }
    });

    // Handle live typing
    socket.on('typing', (data) => {
        if (socket.user) {
            socket.broadcast.emit('userTyping', {
                userId: socket.user._id,
                text: data,
                user: {
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar
                }
            });
        }
    });

    // Handle typing status
    socket.on('typingStatus', (isTyping) => {
        if (socket.user) {
            socket.broadcast.emit('userTypingStatus', {
                userId: socket.user._id,
                isTyping: isTyping,
                user: {
                    displayName: socket.user.displayName,
                    avatar: socket.user.avatar
                }
            });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected');
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
