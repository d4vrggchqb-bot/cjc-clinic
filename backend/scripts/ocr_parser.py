import sys
import json
import os

def parse_document(file_path):
    # This is a placeholder/wrapper script for OCR.
    # In a full implementation, you could use pytesseract:
    # import pytesseract
    # from PIL import Image
    # text = pytesseract.image_to_string(Image.open(file_path))
    
    # Or integrate with an API like Google Cloud Vision or OCR.space.
    
    if not os.path.exists(file_path):
        return {"success": False, "error": "File not found"}
        
    try:
        # Mocking OCR response for now as requested/assumed.
        # This prevents breaking the system if Tesseract is not installed on the Windows host.
        file_size = os.path.getsize(file_path)
        base_name = os.path.basename(file_path)
        ext = os.path.splitext(base_name)[1].lower()
        
        extracted_text = f"--- OCR Parsing Result for {base_name} ---\n"
        extracted_text += f"[Mocked extracted text for a {file_size} byte {ext} file]\n"
        extracted_text += "Patient Name: ...\n"
        extracted_text += "Diagnosis: ...\n"
        
        return {
            "success": True,
            "text": extracted_text,
            "file": base_name
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    file_path = sys.argv[1]
    result = parse_document(file_path)
    print(json.dumps(result))
