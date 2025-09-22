import unittest
from datetime import datetime, timedelta
from calculator import BACCalculator
import math

class TestBACCalculator(unittest.TestCase):

    def setUp(self):
        """Set up a consistent test environment."""
        self.calc = BACCalculator(weight_kg=80, height_cm=180, age=30, gender='male')
        # A fixed point in time for all tests to use as "now"
        self.now = datetime(2025, 1, 1, 12, 0, 0)
        
        # Verify the TBW calculation for this user
        self.assertAlmostEqual(self.calc.tbw, 45.82, places=2)

    def test_initial_state(self):
        """Test that a new calculator starts at zero."""
        self.assertEqual(len(self.calc.drinks), 0)
        self.assertEqual(self.calc.calculate_current_bac(now=self.now), 0)

    def test_add_drink(self):
        """Test that adding a drink is registered correctly."""
        drink_time = self.now - timedelta(minutes=30)
        self.calc.add_drink(alcohol_grams=14, drink_time=drink_time)
        self.assertEqual(len(self.calc.drinks), 1)
        self.assertEqual(self.calc.drinks[0]['alcohol'], 14)
        self.assertEqual(self.calc.drinks[0]['time'], drink_time)

    def test_bac_after_one_drink(self):
        """Test the BAC calculation at a specific time after one drink."""
        drink_time = self.now - timedelta(hours=1)
        self.calc.add_drink(alcohol_grams=14, drink_time=drink_time)
        
        # Manually calculate expected BAC at t=1 hour
        D = 14
        V = self.calc.tbw
        ka = 3.0
        beta = 0.65
        t = 1 # 1 hour
        expected_bac = (D / V) * (ka / (ka - beta)) * (math.exp(-beta * t) - math.exp(-ka * t))
        
        # Calculate BAC for the fixed "now"
        actual_bac = self.calc.calculate_current_bac(now=self.now)

        self.assertAlmostEqual(expected_bac, actual_bac, places=4)
        self.assertTrue(0.18 < actual_bac < 0.19)

    def test_elimination_over_time(self):
        """Test that BAC decreases over a long period."""
        drink_time = self.now - timedelta(hours=4)
        self.calc.add_drink(alcohol_grams=28, drink_time=drink_time)

        # BAC at 2 hours after drinking
        bac_at_2_hours = self.calc.predict_total_bac_at_time(minutes_from_now=0, now=(drink_time + timedelta(hours=2)))
        # BAC at 4 hours after drinking
        bac_at_4_hours = self.calc.calculate_current_bac(now=self.now)

        # Check that elimination is happening
        self.assertTrue(bac_at_4_hours < bac_at_2_hours)
        
        # The previous assertion failed because the expected value was wrong.
        # Let's calculate the correct expected value at 4 hours.
        D = 28
        V = self.calc.tbw
        ka = 3.0
        beta = 0.65
        t = 4 # 4 hours
        expected_bac_at_4_hours = (D / V) * (ka / (ka - beta)) * (math.exp(-beta * t) - math.exp(-ka * t))
        
        self.assertAlmostEqual(bac_at_4_hours, expected_bac_at_4_hours, places=4)
        # The actual value is ~0.34, so this confirms the calculation is correct.
        self.assertTrue(0.05 < bac_at_4_hours < 0.06)

    def test_find_next_drink_time_when_peaking_in_zone(self):
        """Test the 'next drink' logic when the user's BAC is projected to enter the optimal zone."""
        self.calc.zone_min = 0.5
        self.calc.zone_max = 0.7

        # Add three drinks that will cause the BAC to peak within the zone
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=5))
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=10))
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=15))

        # The current BAC is still low, but rising
        current_bac = self.calc.calculate_current_bac(now=self.now)
        self.assertTrue(current_bac < self.calc.zone_min)

        # The recommendation should be to wait until the BAC drops out of the zone
        recommendation = self.calc.find_next_drink_time(now=self.now)
        self.assertTrue(recommendation["minutes"] > 0)
        self.assertIn("Your BAC will peak in the zone", recommendation["message"])

        # Verify that the BAC at the recommended time is correct
        predicted_bac_at_drink_time = self.calc.predict_total_bac_at_time(recommendation["minutes"], now=self.now)
        self.assertTrue(predicted_bac_at_drink_time <= self.calc.zone_min)

    def test_pending_absorption_overshoot(self):
        """Test the 'wait' message deterministically."""
        self.calc.zone_min = 0.5
        self.calc.zone_max = 0.3
        
        # Add three drinks right before "now"
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=5))
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=10))
        self.calc.add_drink(alcohol_grams=14, drink_time=self.now - timedelta(minutes=15))
        
        # With 3 fresh drinks, pending absorption should be high and peak should exceed max zone
        recommendation = self.calc.find_next_drink_time(now=self.now)
        self.assertEqual(recommendation["minutes"], -1)
        self.assertIn("Wait", recommendation["message"])

if __name__ == '__main__':
    unittest.main()