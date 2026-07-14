import sys
import json
import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from datetime import datetime, timedelta

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
            # Use Linear Regression to find the trend of dispensing
            df = pd.DataFrame(history)
            df['date'] = pd.to_datetime(df['date'])
            df = df.sort_values('date')
            
            # Map dates to integers (days since start)
            start_date = df['date'].min()
            df['day_index'] = (df['date'] - start_date).dt.days
            
            X = df[['day_index']].values
            y = df['dispensed'].values
            
            model = LinearRegression()
            model.fit(X, y)
            
            # Predict the next 7 days average to get a forward-looking trend
            last_day_idx = df['day_index'].max()
            future_X = np.array([[last_day_idx + i] for i in range(1, 8)])
            future_y = model.predict(future_X)
            
            # Prevent negative dispensing predictions
            avg_future_daily = max(0.1, np.mean(future_y))
            
            days_rem = int(current_stock / avg_future_daily)
            
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
