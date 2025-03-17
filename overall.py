import cv2
import mediapipe as mp
import pyautogui
import time
import numpy as np
import pygame

import socket
import struct
import pickle

# Create and connect the client socket
client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client_socket.connect(('127.0.0.1', 5555))

data_buffer = b""
payload_size = struct.calcsize("Q")  # 8 bytes for frame length header

def get_frame():
	global data_buffer
	# Wait until we have enough bytes for the frame length header.
	while len(data_buffer) < payload_size:
		packet = client_socket.recv(16384)  # Increased buffer size to 16KB
		if not packet:
			return None
		data_buffer += packet

	# Extract the frame size from the header.
	packed_msg_size = data_buffer[:payload_size]
	data_buffer = data_buffer[payload_size:]
	msg_size = struct.unpack("Q", packed_msg_size)[0]

	# Wait until the entire frame is received.
	while len(data_buffer) < msg_size:
		packet = client_socket.recv(16384)
		if not packet:
			return None
		data_buffer += packet

	frame_data = data_buffer[:msg_size]
	data_buffer = data_buffer[msg_size:]
	# Convert the JPEG byte stream to a NumPy array and decode
	frame = pickle.loads(frame_data)
	return frame

# Initialize pygame for sound
pygame.mixer.init()
sound = pygame.mixer.Sound("blink.mp3") 

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)
mp_drawing = mp.solutions.drawing_utils

# Get screen width and height
screen_width, screen_height = pyautogui.size()

# Open webcam
cap = cv2.VideoCapture(0)

# Eye landmarks (left & right eye indexes in MediaPipe)
LEFT_EYE = [362, 385, 387, 263, 373, 380]   # Right eye
RIGHT_EYE = [33, 160, 158, 133, 153, 144]  # Left eye

# Nose landmark for head tracking
NOSE_TIP = 1  

def eye_aspect_ratio(landmarks, eye_points):
    """Calculate the eye aspect ratio to detect blinks."""
    top = (landmarks[eye_points[1]].y + landmarks[eye_points[2]].y) / 2
    bottom = (landmarks[eye_points[4]].y + landmarks[eye_points[5]].y) / 2
    left = landmarks[eye_points[0]].x
    right = landmarks[eye_points[3]].x
    return (bottom - top) / (right - left)

# Blink Thresholds
BLINK_RATIO = 0.34
L_BLINK_RATIO = 0.39
R_BLINK_RATIO = 0.4

# Blink Counters
blink_counter = 0
left_blink_counter = 0
right_blink_counter = 0

# Blink and Head Tracking Flags
blink_start_time = None
blink_active = False  
text_display = ""  # For blink messages
text_timer = 0  
BLINK_COOLDOWN = 0.5  # Minimum time between blinks (in seconds)

# Head tracking variables
neutral_nose_x, neutral_nose_y = None, None
sensitivity = 3  # Adjust for cursor movement (lower = smoother)
dead_zone = 0.02  # Minimum movement required to trigger cursor change
smoothing_factor = 5  # Higher value = smoother movement

# Store previous positions for smoothing
prev_x_positions = []
prev_y_positions = []

while True:
    frame = get_frame()
    if frame is None:
        print("Disconnected or no more frames.")
        break 
    # Convert the image to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame with MediaPipe
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            landmarks = face_landmarks.landmark

            # Get eye aspect ratio for both eyes
            left_ear = eye_aspect_ratio(landmarks, LEFT_EYE)
            right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE)

            # Get nose position for head tracking
            nose_x = landmarks[NOSE_TIP].x  
            nose_y = landmarks[NOSE_TIP].y  

            # Set the neutral position on the first frame
            if neutral_nose_x is None:
                neutral_nose_x, neutral_nose_y = nose_x, nose_y

            # Calculate movement relative to the neutral position
            delta_x = (nose_x - neutral_nose_x)
            delta_y = (nose_y - neutral_nose_y)

            # Ignore tiny movements (to remove jitter)
            if abs(delta_x) < dead_zone and abs(delta_y) < dead_zone:
                continue

            # Apply sensitivity scaling
            delta_x *= sensitivity
            delta_y *= sensitivity

            # Calculate cursor position
            cursor_x = screen_width // 2 - delta_x * screen_width
            cursor_y = screen_height // 2 + delta_y * screen_height

            # Add new position to smoothing buffer
            prev_x_positions.append(cursor_x)
            prev_y_positions.append(cursor_y)

            # Keep only the last N positions for smoothing
            if len(prev_x_positions) > smoothing_factor:
                prev_x_positions.pop(0)
                prev_y_positions.pop(0)

            # Compute the average of stored positions (smoothing)
            smoothed_x = int(np.mean(prev_x_positions))
            smoothed_y = int(np.mean(prev_y_positions))

            # Keep cursor within screen bounds
            smoothed_x = max(0, min(screen_width, smoothed_x))
            smoothed_y = max(0, min(screen_height, smoothed_y))

            # Move the cursor smoothly
            pyautogui.moveTo(smoothed_x, smoothed_y, duration=0.05)

            # Get current time
            current_time = time.time()

            # Check for blink types
            left_blink = left_ear < L_BLINK_RATIO
            right_blink = right_ear < R_BLINK_RATIO

            # Detect left blink (left-click)
            if left_blink and not blink_active:
                if blink_start_time is None or (current_time - blink_start_time > BLINK_COOLDOWN):
                    blink_active = True
                    blink_start_time = current_time
                    text_timer = current_time  # Start text display timer
                    sound.play()
                    pyautogui.click()
                    text_display = "Left Blink Detected! (Left Click)"
                    left_blink_counter += 1
                    print(text_display)

            # Detect right blink (right-click)
            if right_blink and not blink_active:
                if blink_start_time is None or (current_time - blink_start_time > BLINK_COOLDOWN):
                    blink_active = True
                    blink_start_time = current_time
                    text_timer = current_time  # Start text display timer
                    sound.play()
                    pyautogui.rightClick()
                    text_display = "Right Blink Detected! (Right Click)"
                    right_blink_counter += 1
                    print(text_display)

            # Reset blink flag only when both eyes are fully opened again
            elif not left_blink and not right_blink:
                blink_active = False

            # Draw face mesh landmarks
            mp_drawing.draw_landmarks(frame, face_landmarks, mp_face_mesh.FACEMESH_TESSELATION)

    # Display blink detection messages for 1 second
    if text_display and (time.time() - text_timer < 1):
        cv2.putText(frame, text_display, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    # Display blink counters
    cv2.putText(frame, f"Left Blinks: {left_blink_counter}", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Right Blinks: {right_blink_counter}", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    # Show frame
    cv2.imshow("Head Tracking & Blink Detection (Smoothed)", frame)

    # Adjust sensitivity in real-time using arrow keys
    key = cv2.waitKey(1) & 0xFF
    if key == ord('q'):  # Press 'q' to quit
        break
    elif key == ord('w'):  # Increase sensitivity
        sensitivity += 1
    elif key == ord('s'):  # Decrease sensitivity
        sensitivity = max(1, sensitivity - 1)

# Release resources
cap.release()
cv2.destroyAllWindows()