# to activate the needed libraries run "source venv/bin/activate" on the terminal, make sure that you are in the OpenCV folder

import cv2
import mediapipe as mp
import time
import pygame
import pyautogui

# Initialize pygame for sound
pygame.mixer.init()
sound = pygame.mixer.Sound("blink.mp3") 

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh()
mp_drawing = mp.solutions.drawing_utils

# Open Webcam
cap = cv2.VideoCapture(0)

# Eye landmarks (left & right eye indexes in MediaPipe)
LEFT_EYE = [362, 385, 387, 263, 373, 380]   # Right eye
RIGHT_EYE = [33, 160, 158, 133, 153, 144]  # Left eye

def eye_aspect_ratio(landmarks, eye_points):
    """Calculate the eye aspect ratio to detect blinks."""
    top = (landmarks[eye_points[1]].y + landmarks[eye_points[2]].y) / 2
    bottom = (landmarks[eye_points[4]].y + landmarks[eye_points[5]].y) / 2
    left = landmarks[eye_points[0]].x
    right = landmarks[eye_points[3]].x
    return (bottom - top) / (right - left)

# Blink Thresholds
BLINK_RATIO = 0.35
L_BLINK_RATIO = 0.39
R_BLINK_RATIO = 0.40

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

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Convert BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame with MediaPipe
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            landmarks = face_landmarks.landmark

            # Get eye aspect ratio for both eyes
            left_ear = eye_aspect_ratio(landmarks, LEFT_EYE)
            right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE)

            # Check for blink types
            left_blink = left_ear < L_BLINK_RATIO
            right_blink = right_ear < R_BLINK_RATIO

            # Get current time
            current_time = time.time()

            # Detect left, right, and both-eye blinks with cooldown
            if (left_blink) and not blink_active:
                if blink_start_time is None or (current_time - blink_start_time > BLINK_COOLDOWN):
                    blink_active = True
                    blink_start_time = current_time
                    text_timer = current_time  # Start text display timer
                    sound.play()
                    pyautogui.click()

                    if left_blink and right_blink:
                        text_display = "Both Eyes Blinked!"
                        blink_counter += 1
                    elif left_blink:
                        text_display = "Left Blink Detected!"
                        left_blink_counter += 1
                    elif right_blink:
                        text_display = "Right Blink Detected!"
                        right_blink_counter += 1

                    print(text_display)
                
            if (right_blink) and not blink_active:
                if blink_start_time is None or (current_time - blink_start_time > BLINK_COOLDOWN):
                    blink_active = True
                    blink_start_time = current_time
                    text_timer = current_time  # Start text display timer
                    sound.play()
                    pyautogui.rightClick()

                    if left_blink and right_blink:
                        text_display = "Both Eyes Blinked!"
                        blink_counter += 1
                    elif left_blink:
                        text_display = "Left Blink Detected!"
                        left_blink_counter += 1
                    elif right_blink:
                        text_display = "Right Blink Detected!"
                        right_blink_counter += 1

                    print(text_display)

            # Reset blink flag only when both eyes are fully opened again
            elif not left_blink and not right_blink:
                blink_active = False

    # Display blink detection messages for 1 second
    if text_display and (time.time() - text_timer < 1):
        cv2.putText(frame, text_display, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    # Display blink counters
    cv2.putText(frame, f"Left Blinks: {left_blink_counter}", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Right Blinks: {right_blink_counter}", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
    cv2.putText(frame, f"Both Blinks: {blink_counter}", (50, 250), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

    # Show frame
    cv2.imshow("Blink Detection", frame)

    # Exit with 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()