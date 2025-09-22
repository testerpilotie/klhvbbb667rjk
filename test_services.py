
import unittest
from schemas import CalculationPayload, UserInfo, Drink
from services import BACService

class TestBACService(unittest.TestCase):

    def test_generate_report_success(self):
        """Test that the service generates a valid report with a correct payload."""
        # 1. Arrange: Create a valid Pydantic payload object
        payload = CalculationPayload(
            userInfo=UserInfo(
                weight_kg=80,
                height_cm=180,
                age=30,
                gender='male'
            ),
            drinks=[
                Drink(alcohol_grams=14, timestamp="2025-09-21T12:00:00Z"),
                Drink(alcohol_grams=14, timestamp="2025-09-21T13:00:00Z")
            ]
        )

        # 2. Act: Instantiate the service and generate the report
        service = BACService(payload=payload)
        report = service.generate_report()

        # 3. Assert: Check the generated report
        self.assertIsInstance(report, dict)
        self.assertEqual(report['drink_count'], 2)
        self.assertIn('bac', report)
        self.assertIn('timeline', report)
        self.assertTrue(report['bac'] > 0)

    def test_generate_report_no_drinks(self):
        """Test the service with an empty drinks list."""
        # 1. Arrange
        payload = CalculationPayload(
            userInfo=UserInfo(
                weight_kg=80,
                height_cm=180,
                age=30,
                gender='male'
            ),
            drinks=[]
        )

        # 2. Act
        service = BACService(payload=payload)
        report = service.generate_report()

        # 3. Assert
        self.assertEqual(report['drink_count'], 0)
        self.assertEqual(report['bac'], 0)

if __name__ == '__main__':
    unittest.main()
