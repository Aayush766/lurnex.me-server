require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();


// Middleware
app.use(cors());

app.use(express.json());


// DB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));


// API Routes
app.use('/api/mis', require('./routes/misRoutes'));

app.use('/api/auth', require('./routes/authRoutes'));

app.use('/api/classes', require('./routes/classRoutes'));

app.use('/api/assessments', require('./routes/assessmentRoutes'));

app.use('/api/admin', require('./routes/adminRoutes'));

app.use('/api/users', require('./routes/userRoutes'));

app.use('/api/blogs', require('./routes/blogRoutes'));

app.use('/api/uploads', require('./routes/uploadRoutes'));


// ✅ ADD THIS HERE
const sitemapRoute = require("./routes/sitemap");

app.use("/", sitemapRoute);


// Health Check Route
app.get('/', (req, res) => {
  res.send('Lurnex API Running...');
});


const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);