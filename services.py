from calculator import BACCalculator
from schemas import CalculationPayload
from datetime import datetime, timezone

class BACService:
    """Encapsulates the business logic for generating a BAC report."""
    def __init__(self, payload: CalculationPayload):
        self.payload = payload

    def generate_report(self) -> dict:
        """
        Instantiates a calculator, populates it with data from the payload,
        and returns a dictionary containing the full BAC report.
        """
        user_info = self.payload.userInfo
        calc = BACCalculator(
            weight_kg=user_info.weight_kg,
            height_cm=user_info.height_cm,
            age=user_info.age,
            gender=user_info.gender
        )

        for drink in self.payload.drinks:
            # Convert ISO timestamp string from JSON to a timezone-aware datetime object
            if drink.timestamp.endswith('Z'):
                drink_time = datetime.fromisoformat(drink.timestamp[:-1] + '+00:00')
            else:
                drink_time = datetime.fromisoformat(drink.timestamp)
            
            calc.add_drink(
                alcohol_grams=drink.alcohol_grams,
                drink_time=drink_time
            )

        # Use a consistent "now" for all calculations in this request
        now = datetime.now(timezone.utc)

        # Perform all calculations
        bac = calc.calculate_current_bac(now=now)
        absorption_info = calc.get_pending_absorption(now=now)
        pending = absorption_info['pending']
        peak_bac = absorption_info['peak_bac']
        status = calc.get_zone_status(bac)
        next_drink = calc.find_next_drink_time(now=now)
        timeline = calc.get_bac_timeline(minutes_ahead=180, minutes_back=180, interval=10, now=now)
        zone_limits = calc.get_zone_limits()

        # Format and return the final report
        return {
            'bac': round(bac, 3),
            'pending': round(pending, 3),
            'peak_bac': round(peak_bac, 3),
            'status': status,
            'drink_count': len(calc.drinks),
            'next_drink': next_drink,
            'timeline': timeline,
            'zone_limits': zone_limits,
            'drinks': [drink.dict() for drink in self.payload.drinks] # Convert Pydantic models to dicts
        }
