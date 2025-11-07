# Optihol

Optihol is a web application designed to help users track and predict their Blood Alcohol Content (BAC). The primary goal is to enable users to maintain a specific BAC range, not for harm reduction, but for achieving optimal performance in certain tasks that may be enhanced by a specific, low level of alcohol. All user data is stored privately and securely on the user's own device using modern browser storage technologies to ensure privacy and a persistent, seamless experience, featuring an interactive BAC chart for visualization and an improved drink addition interface with size selection.

## How to Run the Project

### Running the Web Application

1.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

2.  **Run the Flask app:**

    -   **For Development (Debug Mode ON):**
        Set the `FLASK_DEBUG` environment variable to `1` before running the app. This enables the interactive debugger.
        ```bash
        # On Windows
        set FLASK_DEBUG=1
        python app.py

        # On macOS/Linux
        export FLASK_DEBUG=1
        python app.py
        ```

    -   **For Production (Debug Mode OFF):**
        Run the app without the `FLASK_DEBUG` variable. For a real production deployment, always use a proper WSGI server like Gunicorn or uWSGI.
        ```bash
        python app.py
        ```

3.  **Open your browser** and navigate to `http://127.0.0.1:5000`.

### Running the Tests
1.  Navigate to the project's root directory.
2.  Run all tests (unit and integration):
    ```bash
    python -m unittest discover -v
    ```
3.  Or, run a specific test file:
    ```bash
    python -m unittest -v test_calculator.py
    ```
