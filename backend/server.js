const express = require('express');
const cors = require('cors');
const connectDB = require('./src/config/db');
const errorHandler = require('./src/middlewares/errorHandler');

require('dotenv').config();

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/measurements', require('./src/routes/measurements'));
app.use('/api/reports', require('./src/routes/reports'));
app.use('/api/guardians', require('./src/routes/guardians'));
app.use('/api/notifications', require('./src/routes/notifications'));
app.use('/api/internal', require('./src/routes/internal'));

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
