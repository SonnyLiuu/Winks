# to activate the needed libraries run "source venv/bin/activate" on the terminal, make sure that you are in the OpenCV folder

import cv2
import mediapipe as mp
import time
import pygame
import pyautogui
import threading
from collections import deque

# Initialize pygame for sound
pygame.mixer.init()
sound = pygame.mixer.Sound("blink.mp3") 

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(static_image_mode=False, max_num_faces=1, refine_landmarks=True)
mp_drawing = mp.solutions.drawing_utils

# Open Webcam
cap = cv2.VideoCapture(0)

# Eye landmarks (left & right eye indexes in MediaPipe)
LEFT_EYE = [362, 385, 387, 263, 373, 380]  # Right eye
RIGHT_EYE = [33, 160, 158, 133, 153, 144]  # Left eye

def eye_aspect_ratio(landmarks, eye_points):
    """Calculate the eye aspect ratio to detect winks."""
    top = (landmarks[eye_points[1]].y + landmarks[eye_points[2]].y) / 2
    bottom = (landmarks[eye_points[4]].y + landmarks[eye_points[5]].y) / 2
    left = landmarks[eye_points[0]].x
    right = landmarks[eye_points[3]].x
    return (bottom - top) / (right - left)

# Plays a sound and triggers a mouse click (left or right) in a separate thread.
# This prevents blocking the main video processing loop, ensuring responsive interaction.
def play_sound_and_click(is_right_click=False):
    threading.Thread(target=sound.play).start()
    if is_right_click:
        threading.Thread(target=pyautogui.rightClick).start()
    else:
        threading.Thread(target=pyautogui.click).start()

# EAR smoothing
smooth_window = 3
left_ear_queue = deque(maxlen=smooth_window)
right_ear_queue = deque(maxlen=smooth_window)

# Wink Thresholds
BOTH_CLOSED_RATIO = 0.25
L_WINK_RATIO = 0.23
R_WINK_RATIO = 0.24

# Frame requirements
succ_frame = 2
left_frame = 0
right_frame = 0
both_frame = 0

# Wink Tracking Flags
blink_in_progress = False  # Used only to track blinks
left_wink_in_progress = False
right_wink_in_progress = False
text_display = ""  # For wink messages
text_timer = 0

# Wink cooldowns
WINK_COOLDOWN = 0.5  # seconds
last_left_wink = 0
last_right_wink = 0

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Resize frame to standard width
    frame = cv2.resize(frame, (640, int(frame.shape[0] * 640 / frame.shape[1])))

    # Convert BGR to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    # Process the frame with MediaPipe
    results = face_mesh.process(rgb_frame)

    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            landmarks = face_landmarks.landmark

            # Get eye aspect ratio for both eyes
            left_ear_raw = eye_aspect_ratio(landmarks, LEFT_EYE)
            right_ear_raw = eye_aspect_ratio(landmarks, RIGHT_EYE)

            left_ear_queue.append(left_ear_raw)
            right_ear_queue.append(right_ear_raw)

            left_ear = sum(left_ear_queue) / len(left_ear_queue)
            right_ear = sum(right_ear_queue) / len(right_ear_queue)
            avg_ear = (left_ear + right_ear) / 2

            # Get current time
            current_time = time.time()

            # Detect blinks to suppress winks
            if left_ear < L_WINK_RATIO and right_ear < R_WINK_RATIO:
                both_frame += 1
                left_frame = 0
                right_frame = 0
                if both_frame >= succ_frame and not blink_in_progress:
                    blink_in_progress = True
            else:
                both_frame = 0
                blink_in_progress = False

                # Left wink detection only if right eye is clearly open
                if left_ear < L_WINK_RATIO and right_ear > R_WINK_RATIO + 0.02:
                    left_frame += 1
                    right_frame = 0
                    if left_frame >= succ_frame and not left_wink_in_progress and (
                            current_time - last_left_wink) > WINK_COOLDOWN:
                        left_wink_in_progress = True
                        last_left_wink = current_time
                        text_timer = current_time
                        play_sound_and_click()
                        text_display = "Left Wink Detected!"
                        print(text_display)
                else:
                    left_frame = 0
                    left_wink_in_progress = False

                # Right wink detection only if left eye is clearly open
                if right_ear < R_WINK_RATIO and left_ear > L_WINK_RATIO + 0.02:
                    right_frame += 1
                    if right_frame >= succ_frame and not right_wink_in_progress and (
                            current_time - last_right_wink) > WINK_COOLDOWN:
                        right_wink_in_progress = True
                        last_right_wink = current_time
                        text_timer = current_time
                        play_sound_and_click(is_right_click=True)
                        text_display = "Right Wink Detected!"
                        print(text_display)
                else:
                    right_frame = 0
                    right_wink_in_progress = False

            # EAR value display
            cv2.putText(frame, f"L_EAR: {left_ear:.2f}  R_EAR: {right_ear:.2f}", (50, 60), cv2.FONT_HERSHEY_SIMPLEX,
                        0.7, (255, 255, 0), 2)

    # Display wink detection messages for 1 second
    if text_display and (time.time() - text_timer < 1):
        cv2.putText(frame, text_display, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

    # Show frame
    cv2.imshow("Wink Detection", frame)

    # Exit with 'q'
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
