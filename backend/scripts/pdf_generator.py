import sys
import json
import os

def generate_pdf(payload, output_path):
    # In a full implementation, you'd use reportlab, qrcode, or pdfkit here.
    # Since we cannot guarantee those libraries are installed on the host machine,
    # we will generate a valid minimal mock PDF for demonstration purposes.
    
    cert_id = payload.get('id', 'MC-XXXX')
    issued_to = payload.get('issued_to', 'Unknown')
    hash_val = payload.get('hash', '')
    verify_url = payload.get('verify_url', '')
    
    paper_size = payload.get('paper_size', 'half_long')
    # MediaBox dimensions [0 0 width height] in points (72 pt per inch)
    # Long bond paper = 8.5in x 13in (612 x 936 pt)
    # 1/2 crosswise long bond paper = 8.5in x 6.5in (612 x 468 pt)
    # 1/4 long bond paper = 4.25in x 6.5in (306 x 468 pt)
    if paper_size == 'quarter_long':
        mediabox = "0 0 306 468"
        start_y = 430
    elif paper_size == 'full_long':
        mediabox = "0 0 612 936"
        start_y = 880
    elif paper_size == 'a4':
        mediabox = "0 0 595 842"
        start_y = 780
    elif paper_size == 'a5':
        mediabox = "0 0 420 595"
        start_y = 550
    else: # half_long default
        mediabox = "0 0 612 468"
        start_y = 420

    # Minimal PDF structure
    pdf_content = f"""%PDF-1.4
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R] /Count 1>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /Resources 4 0 R /MediaBox [{mediabox}] /Contents 5 0 R>> endobj
4 0 obj <</Font <</F1 <</Type /Font /Subtype /Type1 /BaseFont /Helvetica>>>>>> endobj
5 0 obj <</Length 250>> stream
BT
/F1 14 Tf
36 {start_y} Td (CJC CLINIC - MEDICAL CERTIFICATE) Tj
0 -30 Td (Certificate ID: {cert_id}) Tj
0 -20 Td (Issued To: {issued_to}) Tj
0 -40 Td (--- ANTI-FORGERY SECURITY DATA ---) Tj
0 -20 Td (Cryptographic Hash: {hash_val}) Tj
0 -20 Td (Scan QR Code or visit URL to verify:) Tj
/F1 10 Tf
0 -15 Td ({verify_url}) Tj
ET
endstream endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000056 00000 n
0000000113 00000 n
0000000222 00000 n
0000000308 00000 n
trailer <</Size 6 /Root 1 0 R>>
startxref
559
%%EOF
"""
    
    try:
        # Create output directory if it doesn't exist
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        with open(output_path, 'wb') as f:
            f.write(pdf_content.encode('utf-8'))
            
        return {"success": True, "file": output_path}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    # Expects JSON string as first argument, Output path as second
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Missing arguments"}))
        sys.exit(1)
        
    try:
        payload_json = sys.argv[1]
        output_path = sys.argv[2]
        
        payload = json.loads(payload_json)
        result = generate_pdf(payload, output_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
