# Optihol - Project Coordination

## 1. Project Goal

Optihol is a web application designed to help users track and predict their Blood Alcohol Content (BAC). The primary goal is to enable users to maintain a specific BAC range, not for harm reduction, but for achieving optimal performance in certain tasks that may be enhanced by a specific, low level of alcohol.

---

## 2. Current Status (As of 2025-09-21)

- **Tech Stack:**
  - **Backend:** Python 3, Flask
  - **Frontend:** HTML, CSS, vanilla JavaScript
  - **Testing:** `unittest` framework for both unit and integration tests.

- **Architecture & Functionality:**
  - The application uses a modern, **stateless API architecture** where the frontend client manages all user and session state.
  - The backend provides a pure, stateless calculation endpoint (`/api/calculate`).
  - A **User Settings** modal allows users to input their physical data, which is saved to the browser's `localStorage` for persistence across sessions.

- **Core Logic:**
  - The core BAC calculation is handled by the `BACCalculator` class in `calculator.py`.
  - The calculation engine is robust, using a unified two-compartment pharmacokinetic model.
  - The logic is deterministic and has been thoroughly validated by a suite of unit tests (`test_calculator.py`).

---

## 3. Core Logic & Architecture Verification

A significant effort was undertaken to refactor and verify the application.

1.  **Core Logic Hardening:**
    -   Unified all calculations to use a single, more accurate two-compartment model.
    -   Refactored the calculator to be deterministic, enabling reliable testing.
    -   Developed a comprehensive unit test suite (`test_calculator.py`) which is passing 100%.

2.  **Architectural Refactoring:**
    -   **Resolved Critical Flaw:** The original stateful, single-user architecture was replaced.
    -   **Implemented Stateless API:** The backend was refactored into a stateless API, making the application multi-user capable.
    -   **Decoupled Business Logic:** The backend was further refined by introducing a dedicated Service Layer (`services.py`) and `pydantic` data schemas (`schemas.py`), cleanly separating business logic from the HTTP layer.
    -   **Created Stateful Client:** The frontend was refactored to manage all application state.
    -   **Expanded Test Coverage:** The test suite was expanded with isolated unit tests for the new service layer (`test_services.py`) and validation tests for the API (`test_app.py`). All tests are passing.

---

## 4. External Validation & Sanity Check

To ensure the calculator produces results that are sensible and in line with real-world expectations, a validation was performed against a standard benchmark.

-   **Benchmark:** A standard **Widmark formula** calculator.
-   **Conclusion:** The Optihol calculator produces results that are in the correct ballpark and behave reliably. The differences are explainable and stem from our model's more sophisticated and accurate approach to BAC dynamics. The validation was successful.

---

## 5. Future Improvements Roadmap

This roadmap outlines the next steps for developing Optihol, prioritized into tiers.

### Tier 1: Essential Core Features

-   **[ ] Customizable Drinks:** Allow users to define and save their own drink types with custom names and alcohol content.
-   **[x] User Profiles (via Browser Storage):** Persist the client-side `userInfo` object to the browser's `localStorage` so it is not lost on page refresh.
-   **[ ] Factor in Food Intake:** Add a simple UI to select a food level, which will adjust the absorption rate (`ka`) used in the calculations.

### Tier 2: UI/UX Evolution

Transform the interface from a technical dashboard into an intuitive and engaging consumer product.

-   **1. First-Time User Experience:**
    -   **[ ] Design an "Empty State":** When a new user arrives, show a welcome message and a clear call-to-action to add their first drink, rather than a screen of zeros.
    -   **[ ] Add Explanations:** Provide non-intrusive tooltips or info icons for terms like "Pending BAC" to educate the user.

-   **2. Core Interaction & Input:**
    -   **[ ] Improve the "Add Drink" Flow:** Clicking "Add Drink" should open a simple modal to select the drink type (Beer, Wine, Spirit) and when it was consumed (e.g., "Just now", "15 mins ago").

-   **3. Visual Design & "Feel":**
    -   **[ ] Modernize Aesthetics:** Adopt a clean, modern font (e.g., from Google Fonts) and improve spacing. Introduce a refined color palette and subtle UI effects like soft shadows or gradients for depth.
    -   **[ ] Add Micro-interactions:** Animate number changes, chart updates, and button clicks to make the application feel more responsive and alive.

-   **4. Chart Interactivity:**
    -   **[ ] Implement Interactive Charting:** Allow the user to tap-and-drag along the timeline to "scrub" through time. The main BAC display should update in real-time to show the predicted BAC for the selected point.
    -   **[ ] Enhance Chart Clarity:** Use a more visually appealing style for the "Optimal Zone" and clearly mark the "Now" point on the timeline. This will require a more powerful charting library like **Chart.js** or **D3.js**.

---

## 6. How to Run the Project

### Running the Web Application
1.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
2.  Run the Flask app:
    ```bash
    python app.py
    ```
3.  Open your browser and navigate to `http://127.0.0.1:5000`.

### Running the Tests
1.  Navigate to the project's root directory.
2.  Run all tests (unit and integration):
    ```bash
    python -m unittest discover -v
    ```
3.  Or, run a specific test file:
    ```bash
    python -m unittest -v test_calculator.py
    python -m unittest -v test_app.py
    python -m unittest -v test_services.py
    ```

---

## 7. Advanced Architectural Roadmap

With the backend refactored into a clean Service-Oriented Architecture, the next evolution is to modernize the frontend and expand test coverage.

### Frontend Evolution: Adopting a Component-Based Framework

-   **The Challenge (Vanilla JS):** The current frontend uses a single JavaScript file and direct DOM manipulation. This is not scalable and becomes brittle as the UI complexity grows.
-   **The Next Step:**
    1.  **Introduce a Build Tool:** Use **Vite** to set up a modern frontend development environment with a dev server, hot-reloading, and production optimizations.
    2.  **Adopt a Framework:** Migrate the frontend to a component-based framework like **Vue.js** or **React**. This will allow the UI to be broken down into small, reusable components (`Chart.vue`, `SettingsModal.vue`), making the code vastly more organized and easier to manage.
    3.  **Use Declarative State Management:** A framework will provide a reactive state management system. This will eliminate manual DOM manipulation and automatically update the UI when the underlying data changes, reducing a major source of bugs.

### Testing Evolution: Comprehensive Coverage

-   **The Challenge (Missing Coverage):** While we have good unit and integration tests, the frontend logic and user workflows are currently untested.
-   **The Next Step:**
    1.  **Component Tests:** After adopting a framework, use a tool like **Vitest** to write unit tests for individual UI components.
    2.  **End-to-End (E2E) Tests:** Implement a tool like **Cypress** or **Playwright** to create tests that simulate a full user journey in the browser, from changing settings to adding drinks and seeing the results. This provides the highest level of confidence that the entire system is working correctly.

---

## 8. Advanced Mathematical Roadmap

This section captures long-term, PhD-level improvements to the core calculation engine.

-   **Michaelis-Menten Kinetics:** For higher fidelity, especially at high BACs, replace the current first-order elimination model with a Michaelis-Menten model to more accurately represent liver enzyme saturation.
-   **Stochastic Modeling:** Evolve the model from deterministic to stochastic. Use Monte Carlo methods to represent BAC as a confidence interval (e.g., "a 90% probability your BAC is between 0.51‰ and 0.59‰"), providing a more realistic prediction that accounts for uncertainty.
