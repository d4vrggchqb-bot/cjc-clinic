"""Extract text from a clinical attachment using the local Tesseract engine.

This script deliberately never supplies a sample report.  Returning made-up
findings for an unreadable image is unsafe in a clinical record.
"""

import json
import os
import sys


def result(success, **payload):
    print(json.dumps({"success": success, **payload}, ensure_ascii=False))


def configure_tesseract(pytesseract):
    configured_path = os.getenv("TESSERACT_CMD")
    candidates = [
        configured_path,
        r"C:\\Program Files\\Tesseract-OCR\\tesseract.exe",
        r"C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe",
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            pytesseract.pytesseract.tesseract_cmd = candidate
            return True
    return False


def process_image(filepath):
    try:
        import pytesseract
        from PIL import Image, ImageEnhance, ImageOps
    except ImportError:
        result(False, error="OCR dependencies are not installed. Install the packages in backend/scripts/requirements.txt.")
        return

    if not configure_tesseract(pytesseract):
        result(False, error="Tesseract OCR is not installed or configured on this server.")
        return

    try:
        with Image.open(filepath) as source:
            # Upscaling and contrast normalisation make photographed lab reports
            # substantially more legible without changing the document's content.
            image = ImageOps.grayscale(source)
            image = ImageEnhance.Contrast(image).enhance(1.6)
            if image.width < 1800:
                scale = 1800 / image.width
                image = image.resize((1800, int(image.height * scale)))

            data = pytesseract.image_to_data(
                image,
                config="--oem 3 --psm 6",
                output_type=pytesseract.Output.DICT,
            )
    except Exception as error:
        result(False, error=f"OCR could not read this file: {error}")
        return

    words = []
    confidences = []
    for word, confidence in zip(data["text"], data["conf"]):
        word = word.strip()
        if not word:
            continue
        try:
            confidence = float(confidence)
        except (TypeError, ValueError):
            continue
        if confidence >= 35:
            words.append(word)
            confidences.append(confidence)

    text = " ".join(words).strip()
    average_confidence = round(sum(confidences) / len(confidences), 1) if confidences else 0
    meaningful_words = [word for word in words if sum(char.isalnum() for char in word) >= 4]
    alphanumeric_characters = sum(char.isalnum() for char in text)
    if (
        len(text) < 12
        or alphanumeric_characters < 15
        or len(meaningful_words) < 2
        or average_confidence < 60
    ):
        result(False, error="The image is too unclear for a reliable extraction. Upload a sharper, well-lit scan.", confidence=average_confidence)
        return

    result(True, text=text, confidence=average_confidence, file=filepath)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        result(False, error="No file provided")
    elif not os.path.isfile(sys.argv[1]):
        result(False, error="File does not exist")
    else:
        process_image(sys.argv[1])
