
import unittest
import json
from app import app # Import the Flask app object

class TestAPI(unittest.TestCase):

    def setUp(self):
        """Set up a test client for the Flask application."""
        self.client = app.test_client()
        app.config['TESTING'] = True

    def test_calculate_api_endpoint(self):
        """Test the stateless /api/calculate endpoint with a valid payload."""
        # 1. Arrange: Create a sample payload mimicking a client request
        sample_payload = {
            "userInfo": {
                "weight_kg": 80,
                "height_cm": 180,
                "age": 30,
                "gender": "male"
            },
            "drinks": [
                { "alcohol_grams": 14, "timestamp": "2025-09-21T12:00:00Z" },
                { "alcohol_grams": 14, "timestamp": "2025-09-21T13:00:00Z" }
            ]
        }

        # 2. Act: Send a POST request to the API endpoint
        response = self.client.post(
            '/api/calculate',
            data=json.dumps(sample_payload),
            content_type='application/json'
        )

        # 3. Assert: Check the response
        self.assertEqual(response.status_code, 200, "Response should be OK")

        # Parse the JSON data from the response
        data = json.loads(response.data)

        # Check for the presence of key fields
        self.assertIn('bac', data)
        self.assertIn('timeline', data)
        self.assertIn('drink_count', data)
        self.assertIn('status', data)

        # Check if the data is plausible
        self.assertEqual(data['drink_count'], 2)
        self.assertIsInstance(data['bac'], float)
        self.assertTrue(data['bac'] > 0, "BAC should be greater than zero with two drinks")

    def test_calculate_api_empty_payload(self):
        """Test the endpoint with an empty payload to ensure it returns a zeroed state."""
        # 1. Arrange: An empty payload
        empty_payload = {
            "userInfo": {
                "weight_kg": 80,
                "height_cm": 180,
                "age": 30,
                "gender": "male"
            },
            "drinks": []
        }

        # 2. Act
        response = self.client.post(
            '/api/calculate',
            data=json.dumps(empty_payload),
            content_type='application/json'
        )

        # 3. Assert
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)

        self.assertEqual(data['drink_count'], 0)
        self.assertEqual(data['bac'], 0)
        self.assertEqual(data['status'], 'below')

    def test_calculate_api_invalid_payload(self):
        """Test the endpoint with an invalid payload to ensure it returns a 400 error."""
        # 1. Arrange: Create a payload with invalid data (age < 18)
        invalid_payload = {
            "userInfo": {
                "weight_kg": 80,
                "height_cm": 180,
                "age": 17, # This violates the validation rule (gt=17)
                "gender": "male"
            },
            "drinks": []
        }

        # 2. Act
        response = self.client.post(
            '/api/calculate',
            data=json.dumps(invalid_payload),
            content_type='application/json'
        )

        # 3. Assert
        self.assertEqual(response.status_code, 400, "Should return Bad Request for invalid data")
        data = json.loads(response.data)
        self.assertIn('error', data)
        self.assertIn('details', data)
        self.assertEqual(data['details'][0]['loc'][0], 'userInfo')
        self.assertEqual(data['details'][0]['loc'][1], 'age')

if __name__ == '__main__':
    unittest.main()
