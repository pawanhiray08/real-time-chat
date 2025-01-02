const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = (passport) => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: 'https://real-time-chat-git-main-pawanhiray08s-projects.vercel.app/auth/google/callback',
        proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            console.log('Google OAuth Profile:', {
                id: profile.id,
                displayName: profile.displayName,
                email: profile.emails?.[0]?.value,
                photo: profile.photos?.[0]?.value
            });

            // Validate required fields
            if (!profile.id || !profile.displayName || !profile.emails?.[0]?.value) {
                console.error('Missing required profile fields');
                return done(new Error('Invalid profile data'));
            }

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                console.log('Creating new user...');
                user = await User.create({
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails[0].value,
                    avatar: profile.photos?.[0]?.value || '',
                    createdAt: new Date()
                });
                console.log('New user created:', user);
            } else {
                console.log('Existing user found:', user);
                // Update user data if needed
                user.displayName = profile.displayName;
                user.email = profile.emails[0].value;
                user.avatar = profile.photos?.[0]?.value || user.avatar;
                await user.save();
            }

            return done(null, user);
        } catch (err) {
            console.error('Passport Strategy Error:', err);
            return done(err, null);
        }
    }));

    passport.serializeUser((user, done) => {
        try {
            if (!user._id) {
                return done(new Error('Invalid user object'));
            }
            console.log('Serializing user:', user._id);
            done(null, user._id);
        } catch (err) {
            console.error('Serialize Error:', err);
            done(err, null);
        }
    });

    passport.deserializeUser(async (id, done) => {
        try {
            console.log('Deserializing user:', id);
            if (!id) {
                return done(new Error('Invalid user ID'));
            }
            const user = await User.findById(id);
            if (!user) {
                console.error('User not found:', id);
                return done(null, false);
            }
            done(null, user);
        } catch (err) {
            console.error('Deserialize Error:', err);
            done(err, null);
        }
    });
};
