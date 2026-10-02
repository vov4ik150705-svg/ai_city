"""Measure Outfit text widths for the planned headline strings."""
import os
from PIL import ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOLD = os.path.join(ROOT, "fonts", "Outfit-Bold.ttf")
REG = os.path.join(ROOT, "fonts", "Outfit-Regular.ttf")


def w(text, size, path):
    f = ImageFont.truetype(path, size)
    return f.getbbox(text), f.getlength(text)


tests = [
    ("Let me show you around.", 72, BOLD),
    ("Let me show you", 72, BOLD),
    ("Let me show", 72, BOLD),
    ("you around.", 72, BOLD),
    ("A browser city management game", 32, REG),
    ("Corporator", 32, REG),
    ("The buildings are already here.", 64, BOLD),
    ("Open them.", 34, REG),
    ("They just need the right people.", 64, BOLD),
    ("Give everyone a place to work.", 64, BOLD),
    ("Energy and Compute keep the city running.", 34, REG),
    ("Stake stock tokens. Open industries.", 64, BOLD),
    ("NVDA · Compute", 32, REG),
    ("Work earns Capital.", 60, BOLD),
    ("Shared Payroll", 32, REG),
    ("Capital", 32, REG),
    ("Compete for stock-token prizes.", 54, BOLD),
    ("Compete for", 54, BOLD),
    ("stock-token prizes.", 54, BOLD),
    ("Corporator", 82, BOLD),
    ("See you in the city.", 42, REG),
    ("@corporatorcc", 34, REG),
    ("Engineer", 31, REG),
    ("Logistician", 31, REG),
    ("Manager", 31, REG),
    ("Scientist", 31, REG),
    ("Trader", 31, REG),
    ("AI Research Center", 28, REG),
    ("Workshop", 28, REG),
    ("Bank", 28, REG),
]
for t, s, p in tests:
    bb, ln = w(t, s, p)
    print(f"{s:3d}px  w={ln:7.1f}  bbox={bb}  {t!r}")
