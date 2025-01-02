const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

module.exports = (passport) => {
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.NODE_ENV === 'production'
            ? `${process.env.VERCEL_URL || 'https://truerealchat.vercel.app'}/auth/google/callback`
            : 'http://localhost:8080/auth/google/callback',
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

            let user = await User.findOne({ googleId: profile.id });

            if (!user) {
                console.log('Creating new user...');
                user = await User.create({
                    googleId: profile.id,
                    displayName: profile.displayName,
                    email: profile.emails?.[0]?.value,
                    avatar: profile.photos?.[0]?.value
                });
                console.log('New user created:', user);
            } else {
                console.log('Existing user found:', user);
            }

            return done(null, user);
        } catch (err) {
            console.error('Passport Strategy Error:', err);
            return done(err, null);
        }
    }));

    passport.serializeUser((user, done) => {
        try {
            console.log('Serializing user:', user.id);
            done(null, user.id);
        } catch (err) {
            console.error('Serialize Error:', err);
            done(err, null);
        }
    });

    passport.deserializeUser(async (id, done) => {
        try {
            console.log('Deserializing user:', id);
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
