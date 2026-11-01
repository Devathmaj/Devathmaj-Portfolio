# ClassSync: Automated Timetable Generation System

ClassSync is a modern web application designed to automatically generate conflict-free school and university timetables.

## Core Generation Algorithm

At the heart of ClassSync is a highly optimized **Greedy Algorithm** implemented in Python, which is responsible for resolving the complex multidimensional constraints of timetable generation. 

### How it Works:
1. **Prioritization (Heuristics):** The algorithm begins by sorting all unscheduled lessons based on a heuristic score. Lessons with the most rigid constraints (e.g., highly loaded teachers like those teaching 30+ periods a week) are heavily prioritized and scheduled first on a blank grid.
2. **Greedy Placement:** For each lesson, the algorithm greedily searches for the first available time slot that satisfies all hard constraints (no double-booking of rooms, teachers or classrooms and enforcing maximum occurrences per day). 
3. **Constraint Checking:** During placement, the engine verifies cross-dimensional constraints in real-time using in-memory matrices to ensure O(1) lookups for conflict detection. 
4. **Min-Conflicts Local Search:** If the greedy approach leaves a few lessons unscheduled (e.g. a teacher is fully booked in all remaining free slots of a classroom), the engine enters a Local Search phase. It picks an unscheduled lesson, force-places it into an occupied slot (evicting the current lesson) and cascades the swap by finding a new free slot for the evicted lesson. This puzzle-solving approach perfectly slots in the remaining edge-cases to achieve 100% placement with zero conflicts.

## Technical Architecture

- **Asynchronous Processing:** The greedy generation engine is computationally heavy. To ensure the frontend remains responsive, the generation algorithm is completely decoupled from the main API. It runs in isolated **Celery** background workers, utilizing **Redis** as a message broker to queue jobs and stream progress back to the client.
- **Database Schema:** The primary relational data (master catalogs of faculties, subjects, classrooms and their associative constraints) is modeled in **PostgreSQL**. The schema uses strict foreign keys and cascading deletes to maintain absolute data integrity before the greedy engine even reads the state.
- **Validation Pipeline:** Before the greedy algorithm runs, a pre-computation phase validates the dataset to catch impossible constraints (e.g., a teacher assigned 40 hours of classes but only available for 20 hours).

## Getting Started (Local Development)

The easiest way to get the entire application up and running is through Docker Compose.

1. Ensure you have [Docker](https://www.docker.com/) and Docker Compose installed.
2. Clone the repository and navigate into the root directory.
3. Start the application stack:
   ```bash
   docker compose up --build
   ```
4. Access the application:
   - **Frontend:** http://localhost:5173
   - **Backend API Docs:** http://localhost:8000/docs
