@echo off
echo Installing Python dependencies...
pip install -r requirements.txt

echo Starting AI Reimburse Assistant server...
python server.py

pause