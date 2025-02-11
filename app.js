const express = require('express');
const exphbs = require('express-handlebars');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();

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

// Routes
app.get('/', (req, res) => {
    res.render('index');
});

app.get('/auth', (req, res) => {
    res.render('auth', { 
        isAuthPage: true,
        layout: 'main'
    });
});

// Add new POST route for form handling
app.post('/auth/submit', (req, res) => {
    const { email, password, name, isSignUp } = req.body;
    console.log('Form submission:', {
        type: isSignUp ? 'Sign Up' : 'Sign In',
        data: {
            ...(isSignUp && { name }),
            email,
            password
        }
    });
    res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});