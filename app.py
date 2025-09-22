import os
from flask import Flask, render_template, jsonify, request
from pydantic import ValidationError
from schemas import CalculationPayload
from services import BACService

app = Flask(__name__)

@app.route('/')
def index():
    """Serves the frontend application."""
    return render_template('index.html')

@app.route('/api/calculate', methods=['POST'])
def calculate():
    """Handles BAC calculation requests by validating the payload and delegating to the BACService."""
    try:
        # 1. Validate the incoming JSON against our Pydantic model.
        #    If validation fails, Pydantic raises a ValidationError.
        payload = CalculationPayload(**request.get_json())

        # 2. Instantiate the service with the validated, structured data.
        service = BACService(payload=payload)

        # 3. Call the service to get the results.
        report = service.generate_report()

        # 4. Return the successful response.
        return jsonify(report)

    except ValidationError as e:
        # If the request data is malformed or fails validation, return a 400 Bad Request.
        # Pydantic's e.errors() provides a detailed, developer-friendly error message.
        return jsonify({"error": "Invalid request payload", "details": e.errors()}), 400
    except Exception as e:
        # Catch any other unexpected errors during calculation.
        app.logger.error(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal server error occurred."}), 500

if __name__ == '__main__':
    # Debug mode is enabled ONLY if the FLASK_DEBUG environment variable is set to '1'
    debug_mode = os.environ.get('FLASK_DEBUG') == '1'
    # In a real production environment, use a production-ready WSGI server
    # like Gunicorn or uWSGI instead of the built-in Flask development server.
    app.run(debug=debug_mode)