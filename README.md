# Backend Project

An Express.js REST API backend project.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)

### Installation

```bash
npm install
```

### Running the Server

**Development** (with auto-reload via nodemon):

```bash
npm run dev
```

**Production**:

```bash
npm start
```

The server starts on `http://localhost:3000` by default.

## Project Structure

```
src/
├── config/          # Configuration files
│   └── index.js
├── controllers/     # Request handlers / business logic
│   └── homeController.js
├── middleware/       # Custom middleware functions
│   ├── errorHandler.js
│   └── logger.js
├── routes/          # Express route definitions
│   └── index.js
├── app.js           # Express app setup
└── server.js        # Entry point, starts the HTTP server
```

## API Endpoints

| Method | Endpoint       | Description              |
| ------ | -------------- | ------------------------ |
| GET    | `/api`         | Welcome message          |
| GET    | `/api/health`  | Health check / status    |

## Environment Variables

| Variable   | Default       | Description          |
| ---------- | ------------- | -------------------- |
| `PORT`     | `3000`        | Server port          |
| `NODE_ENV` | `development` | Environment mode     |

Create a `.env` file in the project root to override defaults.
