# Wordle Solver

A comprehensive Wordle solver application with an efficient C backend and a modern web frontend. This project allows users to play Wordle games with AI assistance, supporting various word lengths and providing both fast and efficient solving algorithms.

## 🚀 Try It Live

Experience the Wordle Solver immediately without any setup! Visit the live version at: [**https://mycustom-wordle.netlify.app/**](https://mycustom-wordle.netlify.app/)

This hosted version allows you to:
- Test all features instantly
- Play Wordle games with AI assistance
- Try both fast and efficient solvers
- Share games with others

For local development or custom deployment, continue reading the setup instructions below.

## Features

- **Multi-length Word Support**: Play Wordle with words from 3 to 25 letters
- **AI-Powered Solving**: Two solving modes:
  - **Fast Solver**: Quick solutions using precomputed data
  - **Efficient Solver**: Optimal solutions using entropy calculations
- **Real-time Collaboration**: Create and join games with shareable codes
- **Web Interface**: Clean, responsive UI built with vanilla JavaScript
- **Docker Deployment**: Easy containerized setup with Docker Compose

## Architecture

### Backend
- **Language**: C
- **Components**:
  - `wordle_core.c`: Core Wordle game logic
  - `solver_fast.c`: Fast solver using precomputed word lists
  - `solver_efficient.c`: Entropy-based optimal solver
- **Data**: Precomputed word lists and entropy data in `/data`
- **API**: RESTful endpoints served on port 8080

### Frontend
- **Technologies**: HTML5, CSS3, Vanilla JavaScript
- **Server**: Nginx with reverse proxy configuration
- **Features**: Game board, solver controls, real-time updates

## Prerequisites

- Docker and Docker Compose
- Git (for cloning the repository)

## Installation and Setup

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd "Wordle Solver"
   ```

2. **Configure Backend Connection**:

   Before running, you need to update the backend API endpoints according to your deployment:

   - **In `frontend/nginx.conf`**:
     - Change `proxy_pass https://your-backend-domain.com/api/;` to your backend URL (e.g., `http://localhost:8080/api/;` for local development or your production domain)
     - Update `add_header Access-Control-Allow-Origin https://your-netlify-site.netlify.app` to match your frontend domain

   - **In `frontend/index.html`**:
     - Update `window.API_BASE = 'https://your-backend-domain.com/api';` to match your backend API URL

   - **Backend Environment**:
     - Copy `backend/src/.env.example` to `backend/.env`
     - Update `FRONTEND_ORIGIN="YOUR_FRONTEND_ORIGIN_HERE"` to your frontend domain (e.g., `https://mycustom-wordle.netlify.app`)

3. **Build and run with Docker Compose**:
   ```bash
   docker-compose up --build
   ```

   The application will be available at:
   - Frontend: http://localhost
   - Backend API: http://localhost:8080

## Usage

1. **Start a Game**:
   - Click "Create Game" or "Join Game"
   - Select word length (3-25 letters)
   - Choose number of attempts
   - Optionally enter a prefix
   - Select a starting word from suggestions

2. **Play**:
   - Enter guesses in the input field
   - Use "Solve Fast" for quick suggestions
   - Use "Solve Efficient" for optimal moves
   - Share your game with others using the share code

3. **Solver Modes**:
   - **Fast**: Uses precomputed best starters and quick lookups
   - **Efficient**: Calculates information entropy for optimal word selection

## API Endpoints

The backend provides the following REST API endpoints:

- `POST /api/games` - Create a new game
- `GET /api/games/{id}` - Get game state
- `POST /api/games/{id}/guess` - Submit a guess
- `GET /api/games/{id}/solve` - Get solver suggestions
- And more...

## Development

### Backend Development
- Build: `cd backend && docker build .`
- Run: `docker run -p 8080:8080 wordle-backend`

### Frontend Development
- Serve static files with any web server
- Ensure CORS is configured for API calls

### Data Generation
The `/data` directory contains precomputed word lists and entropy data. To regenerate:
- Modify the C programs in `src/`
- Rebuild and run data generation scripts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

Copyright (c) 2025 Wordle Solver Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense and/or sell
copies of the Software and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Acknowledgments

- Built with C for high-performance computing
- Inspired by the popular Wordle game
- Uses information theory for optimal word selection