const express = require('express');
const sql = require('mssql');
const bcrypt = require('bcrypt');
const path = require('path');
const connectToDatabase = require('./database'); // Import the database connection module
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Serve static files from the current directory
app.use(express.static(__dirname));

// Serve the home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve the signup page
app.get('/SignUpPage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'SignUpPage.html'));
});

// Serve the login page
app.get('/LogInPage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'LogInPage.html'));
});

// Serve the chat page
app.get('/ChatPage.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'ChatPage.html'));
});

// Connect to the database and store pool
connectToDatabase()
    .then(pool => {
        console.log('Connected to MSSQL');
        app.locals.pool = pool;
    })
    .catch(err => {
        console.error('Database connection error:', err);
        // Don't exit the process, just log the error
        // The server will continue running but database operations will fail
    });

// Signup route
app.post('/signup', async (req, res) => {
    try {
        const pool = req.app.locals.pool;
        if (!pool) {
            return res.status(500).send("Database connection not established.");
        }

        const { username, password } = req.body;

        // Input validation
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/; // Only letters, numbers, underscore, length 3-20
        const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/; // At least 8 chars, 1 letter, 1 number

        if (!usernameRegex.test(username)) {
            return res.status(400).send("Username must be 3-20 characters long and can only contain letters, numbers, and underscores.");
        }

        if (!passwordRegex.test(password)) {
            return res.status(400).send("Password must be at least 8 characters long and contain at least one letter and one number.");
        }

        // Check if username already exists
        const checkUser = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT Username FROM [Users] WHERE Username = @username');

        if (checkUser.recordset.length > 0) {
            return res.status(409).send("Username already exists. Please choose a different username.");
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .input('password', sql.NVarChar, hashedPassword)
            .query('INSERT INTO [Users] (Username, Password) VALUES (@username, @password)');

        console.log("User registered:", username);
        res.status(201).send("Signup successful!");
    } catch (error) {
        console.error('Error during signup:', error);
        res.status(500).send(`Signup failed! Error: ${error.message}`);
    }
}); 

// Login route
app.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const pool = req.app.locals.pool;
        if (!pool) {
            return res.status(500).send("Database connection not established.");
        }
        
        // Find the user in the database
        const result = await pool.request()
            .input('username', sql.NVarChar, username)
            .query('SELECT * FROM [Users] WHERE Username = @username');
            
        if (result.recordset.length === 0) {
            return res.status(401).send("Invalid username or password");
        }
        
        const user = result.recordset[0];
        
        // Compare the provided password with the stored hashed password
        const passwordMatch = await bcrypt.compare(password, user.Password);
        
        if (!passwordMatch) {
            return res.status(401).send("Invalid username or password");
        }
        
        // Login successful
        console.log("User logged in:", username);
        res.status(200).json({
            message: "Login successful",
            redirect: "ChatPage.html"
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.status(500).send(`Login failed! Error: ${error.message}`);
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); 