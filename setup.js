{
  "name": "certificate-generator",
  "version": "1.0.0",
  "description": "Micro-SaaS для автоматической генерации сертификатов",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "setup": "node setup.js",
    "test": "node quick-test.js",
    "create-template": "node create-test-template.js",
    "test-api": "node test-api.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "multer": "^1.4.5",
    "pdf-lib": "^1.17.1",
    "nodemailer": "^6.9.7",
    "googleapis": "^128.0.0",
    "sqlite3": "^5.1.6",
    "uuid": "^9.0.1",
    "joi": "^17.11.0",
    "dotenv": "^16.3.1",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  },
  "engines": {
    "node": ">=16.0.0"
  },
  "keywords": ["certificate", "pdf", "automation", "saas"],
  "author": "Your Name",
  "license": "MIT"
}
