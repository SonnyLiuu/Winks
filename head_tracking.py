import cv2
import mediapipe as mp
import pyautogui

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils

# Set up face mesh detector
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Get screen width and height
screen_width, screen_height = pyautogui.size()

# Open a video capture (webcam)
cap = cv2.VideoCapture(0)

# Store the initial nose position (neutral point)
neutral_nose_x, neutral_nose_y = None, None
sensitivity = 4 # Increase for greater cursor movement with smaller head movement

while cap.isOpened():
    ret, frame = cap.read()
    if not ret:
        break

    # Convert the image to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame to get landmarks
    results = face_mesh.process(rgb_frame)

    # If landmarks are detected, draw them on the frame
    if results.multi_face_landmarks:
        for face_landmarks in results.multi_face_landmarks:
            mp_drawing.draw_landmarks(frame, face_landmarks, mp_face_mesh.FACEMESH_TESSELATION)

            # Track the nose (landmark 1)
            nose = face_landmarks.landmark[1]  # Nose landmark
            h, w, c = frame.shape
            nose_x, nose_y = int(nose.x * w), int(nose.y * h)

            # Set the neutral position on the first frame
            if neutral_nose_x is None:
                neutral_nose_x, neutral_nose_y = nose_x, nose_y

            # Calculate movement relative to the neutral position
            delta_x = (nose_x - neutral_nose_x) * sensitivity
            delta_y = (nose_y - neutral_nose_y) * sensitivity

            # Invert the movement for a more intuitive control experience
            cursor_x = screen_width // 2 - delta_x
            cursor_y = screen_height // 2 + delta_y

            # Keep cursor within screen bounds
            cursor_x = max(0, min(screen_width, cursor_x))
            cursor_y = max(0, min(screen_height, cursor_y))

            # Move the cursor
            pyautogui.moveTo(cursor_x, cursor_y, duration=0.05)

            # Draw the nose position for visual feedback
            cv2.circle(frame, (nose_x, nose_y), 5, (0, 255, 0), -1)

    # Display the output
    cv2.imshow("Head Tracking with Scaled Mouse Control", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

# Release resources
cap.release()
cv2.destroyAllWindows()