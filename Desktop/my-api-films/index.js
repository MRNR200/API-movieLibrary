const express = require('express');
const mongoose = require('mongoose');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = 3017;

app.use(express.static('public'));
app.use(express.json());

const secretKey = process.env.SECRET_KEY;

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log('Connected to Mongodb...'))
.catch(err => console.error('Could not connect to Mongodb!!!', err));

const filmSchema = new mongoose.Schema({
    title: { type: String, required: true },
    type: { type: String, enum: ['Movie', 'Mini-Series'], required: true },
    genre: { type: String, enum: ['Action', 'Drama', 'Romance'], required: true },
    year: { type: Number, required: true },
});

const Film = mongoose.model('Film', filmSchema);

function validateFilm(film) {
    const schema = Joi.object({
        title: Joi.string().min(2).max(99).required(),
        type: Joi.string().valid('Movie', 'Mini-Series').required(),
        genre: Joi.string().valid('Action', 'Drama', 'Romance').required(),
        year: Joi.number().integer().min(1990).max(new Date().getFullYear()).required(),
    });
    return schema.validate(film);
}

function generateToken(user) {
    return jwt.sign({ _id: user._id }, secretKey, { expiresIn: '1h' });
}

function authenticateToken(req, res, next) {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).send('Access denied. No token provided.');
    try {
        const decoded = jwt.verify(token, secretKey);
        req.user = decoded;
        next();
    } catch (ex) {
        res.status(400).send('Invalid token.');
    }
}

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// مسیر جدید برای نمایش نوع‌های فیلم و لینک‌های مربوطه
app.get('/films', async (req, res) => {
    const baseUrl = `http://localhost:${port}/films/`;
    const types = ['Movie', 'Mini-Series'];
    
    const links = types.map(type => ({
        type,
        url: `${baseUrl}${type}`
    }));

    res.json(links);
});

// مسیر برای دریافت فیلم‌های نوع Movie
app.get('/films/Movie', async (req, res) => {
    const { page = 1, limit = 10, genre, year } = req.query;
    let filter = { type: 'Movie' };
    if (genre) filter.genre = genre;
    if (year) filter.year = year;

    const films = await Film.find(filter)
        .limit(limit * 1)
        .skip((page - 1) * limit);
    const count = await Film.countDocuments(filter);

    res.json({
        films,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
    });
});

// مسیر برای دریافت فیلم‌های نوع Mini-Series
app.get('/films/Mini-Series', async (req, res) => {
    const { page = 1, limit = 10, genre, year } = req.query;
    let filter = { type: 'Mini-Series' };
    if (genre) filter.genre = genre;
    if (year) filter.year = year;

    const films = await Film.find(filter)
        .limit(limit * 1)
        .skip((page - 1) * limit);
    const count = await Film.countDocuments(filter);

    res.json({
        films,
        totalPages: Math.ceil(count / limit),
        currentPage: page,
    });
});

app.post('/films', authenticateToken, async (req, res) => {
    const { error } = validateFilm(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const film = new Film(req.body);
    await film.save();
    res.status(201).json(film);
});

app.put('/films/:id', authenticateToken, async (req, res) => {
    const { error } = validateFilm(req.body);
    if (error) return res.status(400).send(error.details[0].message);

    const film = await Film.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!film) return res.status(404).send('Film not found.');

    res.json(film);
});

app.delete('/films/:id', authenticateToken, async (req, res) => {
    const film = await Film.findByIdAndDelete(req.params.id);
    if (!film) return res.status(404).send('Film not found.');

    res.send('Film deleted successfully.');
});

app.listen(port, () => {
    console.log("SERVER is Running");
});
