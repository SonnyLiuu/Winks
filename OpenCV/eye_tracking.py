
# to activate the needed libraries run "venv\Scripts\activate" on the terminal, make sure that you are in the OpenCV folder


import cv2
import mediapipe as mp
import time
import pygame

# Initialize pygame for sound
pygame.mixer.init()
sound = pygame.mixer.Sound("blink.mp3") 

# Initialize MediaPipe Face Mesh and detects face
# media pipe also automatically calculates the landmarks on the users face
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh()
mp_drawing = mp.solutions.drawing_utils

# Opens Webcam
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

# Blink Threshold
BLINK_RATIO = 0.34

blink_counter = 0
left_blink_counter = 0
right_blink_counter = 0
blink_start_time = None
blink_active = False  # Prevents multiple detections
text_display = ""  # Message to display on UI
text_timer = 0  

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
            # Draw face mesh
            mp_drawing.draw_landmarks(
                frame, 
                face_landmarks, 
                mp_face_mesh.FACEMESH_TESSELATION,  
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1, circle_radius=1),  
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1, circle_radius=1)
            )

            # Get eye aspect ratio for both eyes
            landmarks = face_landmarks.landmark
            left_ear = eye_aspect_ratio(landmarks, LEFT_EYE)
            right_ear = eye_aspect_ratio(landmarks, RIGHT_EYE)
            
            # Check for blink types
            left_blink = left_ear < BLINK_RATIO
            right_blink = right_ear < BLINK_RATIO
            
            # Detect left, right, and both-eye blinks
            if (left_blink or right_blink) and not blink_active:
                blink_active = True  # Set flag to prevent multiple counts
                blink_start_time = time.time()
                text_timer = time.time()  # Start text display timer
                sound.play()  # Play blink sound

                if left_blink and right_blink:
                    text_display = "Both Eyes Blinked!"
                    blink_counter += 1
                elif left_blink:
                    text_display = "Left Blink Detected!"
                    left_blink_counter += 1
                elif right_blink:
                    text_display = "Right Blink Detected!"
                    right_blink_counter += 1

                print(text_display)  # Print to console
            
            # Reset flag only when both eyes are fully opened again
            elif not left_blink and not right_blink:
                blink_active = False  # Reset flag, allowing a new blink to be counted

    # Display blink detection messages on the screen for 1 second
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