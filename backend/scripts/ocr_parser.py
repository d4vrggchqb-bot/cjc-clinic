import sys
import json
import time
import os

def process_image(filepath):
    # Simulate processing delay to make it feel real
    time.sleep(1.5)
    
    # Mock extracted text for clinic demo purposes
    filename = os.path.basename(filepath).lower()
    
    if 'xray' in filename or 'x-ray' in filename:
        mock_text = """RADIOLOGY REPORT - CHEST X-RAY (PA VIEW)
----------------------------------------
FINDINGS:
- The lungs are clear. No active infiltrates, mass, or consolidation.
- Heart size is within normal limits.
- Diaphragm and sinuses are intact.
- Bony thorax is unremarkable.

IMPRESSION:
NORMAL CHEST FINDINGS."""
    else:
        mock_text = """HEMATOLOGY REPORT (COMPLETE BLOOD COUNT)
----------------------------------------
WBC Count: 7.5 x 10^9/L      [Range: 4.5 - 11.0]
RBC Count: 4.8 x 10^12/L     [Range: 4.0 - 5.5]
Hemoglobin: 14.2 g/dL        [Range: 12.0 - 16.0]
Hematocrit: 42%              [Range: 37 - 47]
Platelet Count: 250 x 10^9/L [Range: 150 - 400]

CLINICAL IMPRESSION:
Normal CBC. No signs of infection or anemia."""

    result = {
        "success": True,
        "text": mock_text,
        "file": filepath
    }
    
    # Print exactly one line of JSON for PHP to decode
    print(json.dumps(result))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        filepath = sys.argv[1]
        if os.path.exists(filepath):
            process_image(filepath)
        else:
            print(json.dumps({"success": False, "error": "File does not exist"}))
    else:
        print(json.dumps({"success": False, "error": "No file provided"}))
