const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');
const session = require('express-session');
const supabase = require('./config/supabase');
const { requireAuth } = require('./middleware/auth');
require('dotenv').config();

const app = express();

// Session middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Configure Handlebars
app.engine('hbs', exphbs.engine({
    extname: '.hbs',
    defaultLayout: 'main',
    layoutsDir: path.join(__dirname, 'views/layouts')
}));

app.set('view engine', 'hbs');
app.set('views', path.join(__dirname, 'views'));

// Auth Routes
app.get('/auth', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('auth', { 
        isAuthPage: true,
        layout: 'main'
    });
});

// Add this after your existing auth routes
app.get('/auth/callback', async (req, res) => {
    res.send(`
        <script>
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const access_token = hashParams.get('access_token');
            
            if (access_token) {
                fetch('/auth/callback/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token })
                })
                .then(response => response.json())
                .then(data => {
                    window.location.href = data.success ? '/' : '/auth?error=' + encodeURIComponent(data.error);
                })
                .catch(error => {
                    window.location.href = '/auth?error=' + encodeURIComponent(error.message);
                });
            } else {
                window.location.href = '/auth?error=No access token found';
            }
        </script>
    `);
});

app.post('/auth/callback/token', async (req, res) => {
    try {
        const { access_token } = req.body;
        if (!access_token) throw new Error('No access token provided');

        const { data: { user }, error } = await supabase.auth.getUser(access_token);
        if (error || !user) throw error || new Error('User not found');

        req.session.user = { access_token, user };
        res.json({ success: true });
    } catch (error) {
        console.error('Auth callback error:', error);
        res.json({ success: false, error: error.message });
    }
});

// Modify your existing Google auth route
app.post('/auth/google', async (req, res) => {
    try {
        const redirectTo = `${process.env.APP_URL}/auth/callback`;
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo,
                queryParams: {
                    access_type: 'offline',
                    prompt: 'consent',
                }
            }
        });
        
        if (error) throw error;
        res.json({ success: true, url: data.url });
    } catch (error) {
        console.error('Google auth error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

// Modify your existing auth submit route
app.post('/auth/submit', async (req, res) => {
    const { email, password, name, isSignUp } = req.body;
    
    try {
        if (isSignUp) {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name
                    }
                }
            });
            
            if (error) throw error;
            
            // Store session immediately after signup
            req.session.user = data.session;
            res.json({ success: true, redirect: '/' });
        } else {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            req.session.user = data.session;
            res.json({ success: true, redirect: '/' });
        }
    } catch (error) {
        console.error('Auth error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get('/auth/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth');
});

// Protected Routes
app.get('/', requireAuth, (req, res) => {
    res.render('index', {
        user: req.user
    });
});

app.get('/settings', requireAuth, (req, res) => {
    res.render('settings', {
        user: req.user
    });
});

// Profile update routes
app.post('/settings/update-profile', requireAuth, async (req, res) => {
    const { fullName } = req.body;
    
    try {
        const { data, error } = await supabase.auth.updateUser({
            data: { full_name: fullName }
        });

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.post('/settings/change-password', requireAuth, async (req, res) => {
    const { password } = req.body;
    
    try {
        const { data, error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Password update error:', error);
        res.status(400).json({ success: false, error: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});