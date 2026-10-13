import base64
import os

def _img_b64(filename: str) -> str:
    """Return a data-URI string for a local asset image."""
    try:
        base_dir = os.path.dirname(os.path.abspath(__file__))
        path = os.path.join(base_dir, filename)
        if not os.path.exists(path):
            path = os.path.join(base_dir, "..", "assets", filename)
        with open(path, "rb") as f:
            data = base64.b64encode(f.read()).decode()
        return f"data:image/png;base64,{data}"
    except Exception:
        return ""

def get_logo_b64() -> str:
    return _img_b64("logo.png")

def get_student_b64() -> str:
    return _img_b64("mascot_student.png")

def get_teacher_b64() -> str:
    return _img_b64("mascot_teacher.png")
