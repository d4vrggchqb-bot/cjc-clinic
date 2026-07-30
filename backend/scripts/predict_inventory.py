import sys
import json
from datetime import datetime, timedelta

def simple_linear_regression(x_vals, y_vals):
    n = len(x_vals)
    if n == 0:
        return 0, 0
    sum_x = sum(x_vals)
    sum_y = sum(y_vals)
    sum_xy = sum(x * y for x, y in zip(x_vals, y_vals))
    sum_xx = sum(x * x for x in x_vals)
    
    denominator = (n * sum_xx) - (sum_x * sum_x)
    if denominator == 0:
        m = 0.0
    else:
        m = ((n * sum_xy) - (sum_x * sum_y)) / denominator
    c = (sum_y - (m * sum_x)) / n
    return m, c

def process_predictions(data):
    items = data.get('items', [])
    results = []

    today = datetime.now()

    for item in items:
        history = item.get('daily_history', [])
        current_stock = item.get('current_stock', 0)
        
        if current_stock <= 0:
            results.append({
                "item_id": item['item_id'],
                "name": item['name'],
                "predicted_depletion_date": today.strftime('%Y-%m-%d'),
                "days_remaining": 0,
                "alert_level": "critical",
                "message": "Out of stock!"
            })
            continue

        if len(history) < 3:
            # Not enough data to run linear regression, use simple average
            total_dispensed = sum([day['dispensed'] for day in history])
            avg_daily = total_dispensed / 30.0 if total_dispensed > 0 else 0
            
            if avg_daily <= 0.1:
                days_rem = 999
            else:
                days_rem = int(current_stock / avg_daily)
        else:
            # Use simple linear regression to find the trend of dispensing
            try:
                sorted_history = sorted(history, key=lambda d: datetime.strptime(d['date'], '%Y-%m-%d'))
                start_date = datetime.strptime(sorted_history[0]['date'], '%Y-%m-%d')
                
                x_vals = []
                y_vals = []
                for entry in sorted_history:
                    dt = datetime.strptime(entry['date'], '%Y-%m-%d')
                    day_index = (dt - start_date).days
                    x_vals.append(day_index)
                    y_vals.append(float(entry['dispensed']))
                
                m, c = simple_linear_regression(x_vals, y_vals)
                
                last_day_idx = max(x_vals) if x_vals else 0
                future_y = [m * (last_day_idx + i) + c for i in range(1, 8)]
                avg_future_daily = max(0.1, sum(future_y) / len(future_y))
                
                days_rem = int(current_stock / avg_future_daily)
            except Exception:
                total_dispensed = sum([day['dispensed'] for day in history])
                avg_daily = max(0.1, total_dispensed / 30.0)
                days_rem = int(current_stock / avg_daily)
            
        depletion_date = today + timedelta(days=days_rem)
        
        if days_rem <= 7:
            alert = "critical"
        elif days_rem <= 21:
            alert = "warning"
        else:
            alert = "safe"
            
        results.append({
            "item_id": item['item_id'],
            "name": item['name'],
            "predicted_depletion_date": depletion_date.strftime('%Y-%m-%d') if days_rem < 365 else "9999-12-31",
            "days_remaining": min(days_rem, 999),
            "alert_level": alert,
            "message": f"Predicted to run out in {days_rem} days." if days_rem < 365 else "Stock is stable."
        })

    return {"predictions": results}

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"error": "No input data provided"}))
            sys.exit(1)
            
        data = json.loads(input_data)
        output = process_predictions(data)
        print(json.dumps(output))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
