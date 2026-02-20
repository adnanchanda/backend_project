<!-- Use this file to provide workspace-specific custom instructions to Copilot. -->

# Express.js Backend Project

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: JavaScript (ES6+)

## Project Conventions
- Use `const` and `let` instead of `var`.
- Use arrow functions where appropriate.
- Follow RESTful API conventions for route naming.
- Keep route handlers thin; move business logic to controllers.
- Use middleware for cross-cutting concerns (logging, error handling, auth).
- Use environment variables for configuration (via `.env` file).

## Project Structure
- `src/` — Application source code
  - `routes/` — Express route definitions
  - `controllers/` — Request handlers / business logic
  - `middleware/` — Custom middleware functions
  - `config/` — Configuration files
- `app.js` — Express app setup
- `server.js` — Entry point, starts the HTTP server
