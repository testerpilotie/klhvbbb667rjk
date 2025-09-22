from datetime import datetime, timedelta
import math

class BACCalculator:
    def __init__(self, weight_kg=95, height_cm=180, age=40, gender='male'):
        self.weight_kg = weight_kg
        self.height_cm = height_cm
        self.age = age
        self.gender = gender
        self.drinks = []
        
        # Optimal BAC zone limits (in promille)
        self.zone_min = 0.5  # Lower limit of optimal zone
        self.zone_max = 0.7  # Upper limit of optimal zone
        
        # Calculate Total Body Water using Watson formula
        if gender == 'male':
            self.tbw = 2.447 - (0.09516 * age) + (0.1074 * height_cm) + (0.3362 * weight_kg)
        else:
            self.tbw = -2.097 + (0.1069 * height_cm) + (0.2466 * weight_kg)
        
    def add_drink(self, alcohol_grams=14, drink_time=None):
        """Add a drink with a specific timestamp"""
        if drink_time is None:
            drink_time = datetime.now()
        self.drinks.append({
            'time': drink_time,
            'alcohol': alcohol_grams,
            'ka': 3.0  # absorption rate constant (per hour)
        })
    
    def calculate_current_bac(self, now=None):
        """Calculate current BAC using two-compartment pharmacokinetic model"""
        if not self.drinks:
            return 0.0
        return self.predict_total_bac_at_time(0, now=now)
    
    def get_pending_absorption(self, now=None):
        """Calculate peak BAC, pending absorption, and time to peak."""
        if not self.drinks:
            return {'pending': 0.0, 'peak_bac': 0.0, 'time_to_peak': 0}

        current_bac = self.calculate_current_bac(now=now)
        
        peak_bac = current_bac
        time_to_peak = 0
        
        # Test from 0 to 2 hours in 1-minute intervals for more precision
        for minutes in range(1, 121):
            bac_at_time = self.predict_total_bac_at_time(minutes, now=now)
            if bac_at_time > peak_bac:
                peak_bac = bac_at_time
                time_to_peak = minutes
        
        pending = max(0, peak_bac - current_bac)
        return {'pending': pending, 'peak_bac': peak_bac, 'time_to_peak': time_to_peak}
    
    def predict_total_bac_at_time(self, minutes_from_now, now=None):
        """Predict total BAC using proper two-compartment pharmacokinetic model"""
        if now is None:
            now = datetime.now()
        
        target_time = now + timedelta(minutes=minutes_from_now)
        total_bac = 0.0
        
        # Elimination rate constant (β) - 0.65‰ per hour
        beta = 0.65
        
        for drink in self.drinks:
            hours_elapsed = (target_time - drink['time']).total_seconds() / 3600
            
            if hours_elapsed < 0:
                continue
            
            # Maximum BAC if absorbed instantly (Watson formula)
            max_bac = (drink['alcohol'] / self.tbw)
            
            # Absorption rate constant (ka) - typically 2-4 per hour
            ka = drink.get('ka', 3.0)
            
            # Two-compartment model: BAC(t) = (D/V) * (ka/(ka-β)) * (e^(-β*t) - e^(-ka*t))
            if ka == beta:  # Avoid division by zero
                bac_contribution = max_bac * hours_elapsed * beta * math.exp(-beta * hours_elapsed)
            else:
                bac_contribution = max_bac * (ka / (ka - beta)) * (math.exp(-beta * hours_elapsed) - math.exp(-ka * hours_elapsed))
            
            total_bac += max(0, bac_contribution)
            
        return total_bac
    
    def get_bac_timeline(self, minutes_ahead=180, minutes_back=0, interval=5, now=None):
        """Get BAC predictions for graphing"""
        if now is None:
            now = datetime.now()
        
        timeline = []
        for minutes in range(-minutes_back, minutes_ahead + 1, interval):
            bac = self.predict_total_bac_at_time(minutes, now=now)
            timeline.append((minutes, bac))
        return timeline
    
    def get_zone_status(self, bac):
        """Check if in optimal zone"""
        if bac < self.zone_min:
            return "below"
        elif bac > self.zone_max:
            return "above"
        else:
            return "optimal"
    
    def get_zone_limits(self):
        """Get the current optimal zone limits"""
        return {'min': self.zone_min, 'max': self.zone_max}
    
    def find_next_drink_time(self, target_zone_min=None, target_zone_max=None, now=None):
        """Calculate when to drink next to maintain zone."""
        if now is None:
            now = datetime.now()

        if target_zone_min is None:
            target_zone_min = self.zone_min
        if target_zone_max is None:
            target_zone_max = self.zone_max

        absorption_info = self.get_pending_absorption(now=now)
        peak_bac = absorption_info['peak_bac']

        # If peak BAC will overshoot the zone, advise waiting.
        if peak_bac > target_zone_max:
            return {"minutes": -1, "message": f"Wait. Your BAC is rising and will overshoot the optimal zone, peaking at {peak_bac:.2f}‰."}

        # If peak BAC is within the optimal zone, find when it will drop below the minimum.
        if peak_bac >= target_zone_min:
            start_minute = absorption_info['time_to_peak']
            for minutes in range(start_minute, 361, 5): # Check up to 6 hours from peak
                future_bac = self.predict_total_bac_at_time(minutes, now=now)
                if future_bac <= target_zone_min:
                    return {"minutes": minutes, "message": f"Your BAC will peak in the zone. Drink in {minutes} minutes to stay in it."}
            return {"minutes": 360, "message": "You're in the zone for the next 6+ hours."}

        # If peak BAC is below the zone, find when to drink to reach the zone.
        else:
            # This case is more complex - for now, we recommend drinking when BAC bottoms out.
            # A true "time to next drink to *enter* the zone" is a future improvement.
            start_minute = absorption_info['time_to_peak']
            # Find when the current BAC trend bottoms out
            min_bac = peak_bac
            min_bac_time = start_minute
            for minutes in range(start_minute, 181, 5):
                future_bac = self.predict_total_bac_at_time(minutes, now=now)
                if future_bac < min_bac:
                    min_bac = future_bac
                    min_bac_time = minutes
                else:
                    # BAC has started to rise again after bottoming out (or flattened)
                    break
            return {"minutes": min_bac_time, "message": f"Your BAC is not projected to reach the optimal zone. Drink in {min_bac_time} minutes."}
