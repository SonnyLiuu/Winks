This project uses Python 3.10.11 along with the following key libraries:
- mediapipe
- opencv-python (cv2)
- pyautogui
- numpy
- pygame

Follow these steps to set up your virtual environment and install the dependencies.

# Creating Venv (first time only)
Windows
python -m venv venv

Mac
python3 -m venv venv

# Enter the Venv
Windows
venv\Scripts\activate

Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run code inside the venv
python head_tracking.py