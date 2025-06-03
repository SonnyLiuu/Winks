import cv2
import mediapipe as mp
import pyautogui
import time
import numpy as np
from collections import deque

import multiprocessing
import cython

true = cython.declare(cython.bint, 1)

global cap
cap = cv2.VideoCapture(0)

pyautogui.FAILSAFE = False

def eye_aspect_ratio(landmarks, eye_points):
    """Calculate the eye aspect ratio to detect blinks."""
    top = (landmarks[eye_points[1]].y + landmarks[eye_points[2]].y) / 2
    bottom = (landmarks[eye_points[4]].y + landmarks[eye_points[5]].y) / 2
    left = landmarks[eye_points[0]].x
    right = landmarks[eye_points[3]].x
    return (bottom - top) / (right - left)

def get_frame(frame_queue):
    # Create and connect the client socket
    '''client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client_socket.connect(('127.0.0.1', 5555))

    global data_buffer
    data_buffer = b""
    payload_size = struct.calcsize("Q")  # 8 bytes for frame length header
    
    while True:
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

        # Wait until the entire frame is received.-
        while len(data_buffer) < msg_size:
            packet = client_socket.recv(16384)
            if not packet:
                return None
            data_buffer += packet

        frame_data = data_buffer[:msg_size]
        data_buffer = data_buffer[msg_size:]
        # Convert the JPEG byte stream to a NumPy array and decode
        frame = pickle.loads(frame_data)'''
    
    while (true):
        ret, frame = cap.read()
        
        #If the queue is full, simply ignore this frame and continue. This will help with reducing 'lagging' mouse movement and clicks
        if (frame_queue.full()):
            continue
        frame_queue.put(frame)

def image_processing(frame_queue, mouse_movement_queue, wink_queue):
    # Initialize pygame for sound
    #pygame.mixer.init()
    #sound = pygame.mixer.Sound("blink.mp3") 

    # Initialize MediaPipe Face Mesh
    mp_face_mesh = mp.solutions.face_mesh
    face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5,
                                      min_tracking_confidence=0.5,
                                      refine_landmarks=True,
                                      static_image_mode=False
                                      )
    mp_drawing = mp.solutions.drawing_utils

    # Get screen width and height
    '''screen_height: cython.int
    screen_width: cython.int'''
    screen_width, screen_height = pyautogui.size()

    # Eye landmarks (left & right eye indexes in MediaPipe)
    LEFT_EYE = [362, 385, 387, 263, 373, 380]   # Right eye
    RIGHT_EYE = [33, 160, 158, 133, 153, 144]  # Left eye

    # Nose landmark for head tracking
    NOSE_TIP = 1

    # Blink and Head Tracking Flags
    text_display = ""  # For blink messages
    text_timer = 0  

    # Head tracking variables
    neutral_nose_x, neutral_nose_y = None, None
    #sensitivity: cython.double
    sensitivity = 3  # Adjust for cursor movement (lower = smoother)
    dead_zone = 0.02  # Minimum movement required to trigger cursor change
    smoothing_factor = 5  # Higher value = smoother movement

    # Store previous positions for smoothing
    prev_x_positions = []
    prev_y_positions = []

    # EAR smoothing
    smooth_window = 4
    left_ear_queue = deque(maxlen=smooth_window)
    right_ear_queue = deque(maxlen=smooth_window)

    # Wink Thresholds
    BOTH_CLOSED_RATIO = 0.5
    L_WINK_RATIO = 0.30
    R_WINK_RATIO = 0.30
    
    while true:
        while frame_queue.empty(): # If the queue is empty wait until the queue is populated with something
            continue
        frame = frame_queue.get()
        
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
                left_ear_raw = eye_aspect_ratio(landmarks, LEFT_EYE)
                right_ear_raw = eye_aspect_ratio(landmarks, RIGHT_EYE)

                left_ear_queue.append(left_ear_raw)
                right_ear_queue.append(right_ear_raw)

                left_ear = sum(left_ear_queue) / len(left_ear_queue)
                right_ear = sum(right_ear_queue) / len(right_ear_queue)

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
                
                # Put the smoothed mouse coordinates into the queue
                mouse_movement_queue.put((smoothed_x, smoothed_y))

                # Check for blink types
                left_wink = left_ear < L_WINK_RATIO
                right_wink = right_ear < R_WINK_RATIO
                
                # If a wink was detected, put it into the queue and the wink process will handle it
                if (left_wink or right_wink):
                    wink_queue.put((left_wink, right_wink))
                
                # Draw face mesh landmarks
                mp_drawing.draw_landmarks(frame, face_landmarks, mp_face_mesh.FACEMESH_TESSELATION)


        # Display blink detection messages for 1 second
        if text_display and (time.time() - text_timer < 1):
            cv2.putText(frame, text_display, (50, 100), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # Display blink counters
        #cv2.putText(frame, f"Left Blinks: {left_blink_counter}", (50, 150), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        #cv2.putText(frame, f"Right Blinks: {right_blink_counter}", (50, 200), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)

        # Show frame
        cv2.imshow("Head Tracking & Wink Detection (Smoothed)", frame)

        # Adjust sensitivity in real-time using arrow keys
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):  # Press 'q' to quit
            break
        elif key == ord('w'):  # Increase sensitivity
            sensitivity += 1
        elif key == ord('s'):  # Decrease sensitivity
            sensitivity = max(1, sensitivity - 1)

def blinker(wink_queue):
    # Frame requirements
    consecutive_frames = 2
    left_frame = 0
    right_frame = 0
    both_frame = 0

    # Wink Tracking Flags
    blink_in_progress = False  # Used only to track blinks
    left_wink_in_progress = False
    right_wink_in_progress = False

    # Wink cooldowns
    WINK_COOLDOWN = 0.5  # Minimum time between winks (in seconds)
    last_left_wink = 0
    last_right_wink = 0

    while true:
        # Wait until the queue has something to act on
        while wink_queue.empty():
            blink_in_progress = False
            continue
        
        # Get current time
        current_time = time.time()
        
        left_wink, right_wink = wink_queue.get()

        # Detect blinks to suppress winks
        if left_wink and right_wink:
            both_frame += 1
            left_frame = 0
            right_frame = 0
            if both_frame >= consecutive_frames and not blink_in_progress:
                blink_in_progress = True
        else:
            # Reset blink flag only when both eyes are fully opened again
            both_frame = 0
            blink_in_progress = False

        # Detect left blink (left-click)
        if left_wink and not right_wink:
            left_frame += 1
            right_frame = 0
            current_time = time.time()
            if left_frame >= consecutive_frames and not left_wink_in_progress and (
                    current_time - last_left_wink) > WINK_COOLDOWN:
                left_wink_in_progress = True
                last_left_wink = current_time
                #text_timer = current_time # Start text display timer
                #sound.play()
                pyautogui.click()
                text_display = "Left Blink Detected! (Left Click)"
                #left_blink_counter += 1
                print(text_display)
        else:
            left_frame = 0
            left_wink_in_progress = False

        # Detect right blink (right-click)
        if right_wink and not left_wink:
            left_frame = 0
            right_frame += 1
            current_time = time.time()
            if right_frame >= consecutive_frames and not right_wink_in_progress and (
                    current_time - last_right_wink) > WINK_COOLDOWN:
                right_wink_in_progress = True
                last_right_wink = current_time
                #text_timer = current_time  # Start text display timer
                #sound.play()
                pyautogui.rightClick()
                text_display = "Right Blink Detected! (Right Click)"
                #right_blink_counter += 1
                print(text_display)
        else:
            right_frame = 0
            right_wink_in_progress = False

def mouse_movement(mouse_movement_queue):
    last_time = 0
    
    while true:
        while mouse_movement_queue.empty(): # Wait until queue is populated
            continue
        smoothed_x, smoothed_y = mouse_movement_queue.get()
        # Move the cursor smoothly
        pyautogui.moveTo(smoothed_x, smoothed_y, duration=0.05)
        last_time = timer(last_time)
            
def timer(last_time):
    cur_time = time.time()
    print("time between polls: ", (cur_time - last_time))
    return cur_time
        
def main():
    multiprocessing.freeze_support()
    frame_queue = multiprocessing.Queue(maxsize=1) # Create a queue that holds a max of 1 frame in advance
    mouse_movement_queue = multiprocessing.Queue(maxsize=1) # Create a queue for mouse movement coordinates 1 frame in advance
    wink_queue = multiprocessing.Queue(maxsize=1) # Create a queue for detected winks
    frame_get_process = multiprocessing.Process(target=get_frame, args=(frame_queue,), daemon=True)
    image_processor = multiprocessing.Process(target=image_processing, args=(frame_queue, mouse_movement_queue, wink_queue), daemon=True)
    mouse_mover = multiprocessing.Process(target=mouse_movement, args=(mouse_movement_queue,), daemon=True)
    clicker = multiprocessing.Process(target=blinker, args=(wink_queue,), daemon=True)
    frame_get_process.start()
    image_processor.start()
    mouse_mover.start()
    clicker.start()
    
    while(cv2.getWindowProperty("Head Tracking & Blink Detection (Smoothed)", cv2.WND_PROP_VISIBLE)) >= 0:  # Let main code run until the user presses 'q' or exits the tracking window
        if cv2.waitKey(100) & 0xFF == ord('q'):
            break
        
    # Release resources
    cv2.destroyAllWindows()
    
if __name__ == '__main__':
    main()
    