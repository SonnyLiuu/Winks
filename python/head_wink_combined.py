import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import pyautogui
import numpy as np
import math
from mediapipe.framework.formats import landmark_pb2
import queue
import time
import sys
import os
import signal
from collections import deque
import threading
import json

# --- Thread-Safe Configuration Manager ---
class ConfigManager:
    def __init__(self):
        self._lock = threading.Lock()
        # Default values
        self.SENSITIVITY_PHYSICAL_YAW = 45.0
        self.SENSITIVITY_PHYSICAL_PITCH = 45.0
        self.DEAD_ZONE_DEGREES = 5.0
        self.MAX_JOYSTICK_TILT_ANGLE = 20.0
        self.INVERT_HORIZONTAL_MOUSE = False
        self.INVERT_VERTICAL_MOUSE = False
        self.WINK_L_WINK_RATIO = 0.23
        self.WINK_R_WINK_RATIO = 0.24
        self.WINK_SUCC_FRAME = 2
        self.WINK_COOLDOWN = 0.5

    def update_sensitivities(self, yaw, pitch):
        with self._lock:
            self.SENSITIVITY_PHYSICAL_YAW = yaw
            self.SENSITIVITY_PHYSICAL_PITCH = pitch
        print(f"ConfigManager: Updated sensitivities to Yaw={yaw}, Pitch={pitch}")

    def update_calibration(self, data):
        with self._lock:
            # Update values only if they are provided in the data from Electron
            self.WINK_L_WINK_RATIO = data.get('l_wink_ratio', self.WINK_L_WINK_RATIO)
            self.WINK_R_WINK_RATIO = data.get('r_wink_ratio', self.WINK_R_WINK_RATIO)
            self.WINK_SUCC_FRAME = data.get('wink_succ_frame', self.WINK_SUCC_FRAME)
            self.WINK_COOLDOWN = data.get('wink_cooldown', self.WINK_COOLDOWN)
        print(f"ConfigManager: Updated calibration data.")

    def get_config(self):
        """Returns a copy of the current config values in a thread-safe way."""
        with self._lock:
            return {
                "SENSITIVITY_PHYSICAL_YAW": self.SENSITIVITY_PHYSICAL_YAW,
                "SENSITIVITY_PHYSICAL_PITCH": self.SENSITIVITY_PHYSICAL_PITCH,
                "DEAD_ZONE_DEGREES": self.DEAD_ZONE_DEGREES,
                "MAX_JOYSTICK_TILT_ANGLE": self.MAX_JOYSTICK_TILT_ANGLE,
                "INVERT_HORIZONTAL_MOUSE": self.INVERT_HORIZONTAL_MOUSE,
                "INVERT_VERTICAL_MOUSE": self.INVERT_VERTICAL_MOUSE,
                "WINK_L_WINK_RATIO": self.WINK_L_WINK_RATIO,
                "WINK_R_WINK_RATIO": self.WINK_R_WINK_RATIO,
                "WINK_SUCC_FRAME": self.WINK_SUCC_FRAME,
                "WINK_COOLDOWN": self.WINK_COOLDOWN
            }

# --- Shared Data Structures ---
frame_queue = queue.Queue(maxsize=2)
result_queue = queue.Queue(maxsize=2)
stop_event = threading.Event()
config = ConfigManager() # Create a single, shared instance of the config manager

# --- Helper Functions (Unchanged) ---
def rotation_matrix_to_identified_physical_angles(rotation_matrix):
    sy = math.sqrt(rotation_matrix[0,0] * rotation_matrix[0,0] + rotation_matrix[1,0] * rotation_matrix[1,0])
    singular = sy < 1e-6
    if not singular:
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        phys_pitch_val = math.atan2(rotation_matrix[2,1] , rotation_matrix[2,2])
    else:
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        phys_pitch_val = math.atan2(-rotation_matrix[1,2], rotation_matrix[1,1])
    return math.degrees(phys_yaw_val), math.degrees(phys_pitch_val)

def calculate_ear(landmarks, eye_points):
    if not landmarks or max(eye_points) >= len(landmarks): return 999.0
    points = [landmarks[i] for i in eye_points]
    if any(lm is None for lm in points): return 999.0
    top_y = (points[1].y + points[2].y) / 2
    bottom_y = (points[4].y + points[5].y) / 2
    horizontal_dist = abs(points[3].x - points[0].x)
    if horizontal_dist == 0: return 999.0
    return abs(top_y - bottom_y) / horizontal_dist

# --- Thread 1: Camera Capture (Unchanged) ---
def camera_thread_func(camera_index, frame_read_delay):
    print("Camera Thread: Starting.")
    cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
    if not cap.isOpened():
        print("Camera Thread: CRITICAL ERROR - Could not open video device.")
        stop_event.set()
        return
    while not stop_event.is_set():
        ret, frame = cap.read()
        if not ret:
            print("Camera Thread: WARNING - Failed to grab frame.")
            time.sleep(frame_read_delay)
            continue
        try:
            frame_queue.get_nowait()
        except queue.Empty:
            pass
        frame_queue.put(frame)
    cap.release()
    print("Camera Thread: Finished.")

# --- Thread 2: Detection and Logic (UPDATED) ---
def detection_and_logic_thread_func(model_path, config_manager):
    print("Detector/Logic Thread: Starting.")
    
    pyautogui.MINIMUM_DURATION = 0.0
    pyautogui.MINIMUM_SLEEP = 0.0
    pyautogui.PAUSE = 0.0
    pyautogui.FAILSAFE = False
    
    WINK_LEFT_EYE_LANDMARKS = [362, 385, 387, 263, 373, 380]
    WINK_RIGHT_EYE_LANDMARKS = [33, 160, 158, 133, 153, 144]
    WINK_EAR_SMOOTH_WINDOW = 3

    left_ear_queue, right_ear_queue = deque(maxlen=WINK_EAR_SMOOTH_WINDOW), deque(maxlen=WINK_EAR_SMOOTH_WINDOW)
    wink_text_display, wink_text_timer = "", 0
    left_frame, right_frame = 0, 0
    last_left_wink, last_right_wink = 0, 0
    left_wink_in_progress, right_wink_in_progress = False, False

    def trigger_click(is_right_click=False):
        if is_right_click: pyautogui.rightClick()
        else: pyautogui.click()

    try:
        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options, output_face_blendshapes=False,
            output_facial_transformation_matrixes=True, num_faces=1)
        landmarker = vision.FaceLandmarker.create_from_options(options)
        print("Detector/Logic Thread: FaceLandmarker initialized successfully.")
    except Exception as e:
        print(f"Detector/Logic Thread: CRITICAL ERROR - {e}")
        stop_event.set()
        return

    while not stop_event.is_set():
        try:
            # Get the latest config values at the start of each loop
            current_config = config_manager.get_config()
            
            frame_bgr = frame_queue.get(timeout=1)
            
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
            detection_result = landmarker.detect(mp_image)

            current_physical_yaw, current_physical_pitch = 0.0, 0.0
            
            if wink_text_display and (time.time() - wink_text_timer > 1):
                wink_text_display = ""

            if detection_result and detection_result.facial_transformation_matrixes:
                matrix = np.array(detection_result.facial_transformation_matrixes[0]).reshape(4,4)[:3,:3]
                current_physical_yaw, current_physical_pitch = rotation_matrix_to_identified_physical_angles(matrix)
                
                mouse_dx, mouse_dy = 0, 0
                if abs(current_physical_yaw) > current_config["DEAD_ZONE_DEGREES"]:
                    eff_yaw = current_physical_yaw - (current_config["DEAD_ZONE_DEGREES"] * np.sign(current_physical_yaw))
                    spd_yaw = max(-1.0, min(1.0, eff_yaw / current_config["MAX_JOYSTICK_TILT_ANGLE"]))
                    mouse_dx = -(spd_yaw * current_config["SENSITIVITY_PHYSICAL_YAW"])
                
                if abs(current_physical_pitch) > current_config["DEAD_ZONE_DEGREES"]:
                    eff_pitch = current_physical_pitch - (current_config["DEAD_ZONE_DEGREES"] * np.sign(current_physical_pitch))
                    spd_pitch = max(-1.0, min(1.0, eff_pitch / current_config["MAX_JOYSTICK_TILT_ANGLE"]))
                    mouse_dy = spd_pitch * current_config["SENSITIVITY_PHYSICAL_PITCH"]
                
                if mouse_dx != 0 or mouse_dy != 0:
                    pyautogui.move(int(mouse_dx), int(mouse_dy), duration=0)

            if detection_result and detection_result.face_landmarks:
                landmarks = detection_result.face_landmarks[0]
                left_ear_queue.append(calculate_ear(landmarks, WINK_LEFT_EYE_LANDMARKS))
                right_ear_queue.append(calculate_ear(landmarks, WINK_RIGHT_EYE_LANDMARKS))

                if len(left_ear_queue) == WINK_EAR_SMOOTH_WINDOW:
                    left_ear, right_ear = sum(left_ear_queue)/len(left_ear_queue), sum(right_ear_queue)/len(right_ear_queue)
                    current_time = time.time()

                    if left_ear < current_config["WINK_L_WINK_RATIO"] and right_ear > current_config["WINK_R_WINK_RATIO"] + 0.02:
                        left_frame += 1
                        if left_frame >= current_config["WINK_SUCC_FRAME"] and not left_wink_in_progress and (current_time - last_left_wink) > current_config["WINK_COOLDOWN"]:
                            left_wink_in_progress, last_left_wink, wink_text_timer = True, current_time, current_time
                            trigger_click(is_right_click=False)
                            wink_text_display = "Left Wink!"
                    else:
                        left_frame, left_wink_in_progress = 0, False
                    
                    if right_ear < current_config["WINK_R_WINK_RATIO"] and left_ear > current_config["WINK_L_WINK_RATIO"] + 0.02:
                        right_frame +=1
                        if right_frame >= current_config["WINK_SUCC_FRAME"] and not right_wink_in_progress and (current_time - last_right_wink) > current_config["WINK_COOLDOWN"]:
                            right_wink_in_progress, last_right_wink, wink_text_timer = True, current_time, current_time
                            trigger_click(is_right_click=True)
                            wink_text_display = "Right Wink!"
                    else:
                        right_frame, right_wink_in_progress = 0, False
            try:
                result_queue.put_nowait((frame_bgr, detection_result, current_physical_yaw, current_physical_pitch, wink_text_display, wink_text_timer))
            except queue.Full:
                pass
        except queue.Empty:
            continue
    landmarker.close()
    print("Detector/Logic Thread: Finished.")

# --- Stdin Listener Thread (UPDATED) ---
def stdin_listener_thread_func(config_manager):
    print("Stdin Listener: Thread starting.")
    while not stop_event.is_set():
        try:
            line = sys.stdin.readline()
            if not line:
                print("Stdin Listener: stdin pipe closed.")
                stop_event.set()
                break
                
            command = json.loads(line.strip())
            cmd_type = command.get("type")

            if cmd_type == "stop":
                print("Stdin Listener: Received stop command.")
                stop_event.set()
                break
            elif cmd_type == "update_sensitivities":
                config_manager.update_sensitivities(command.get("yaw"), command.get("pitch"))
            elif cmd_type == "update_calibration":
                config_manager.update_calibration(command)

        except (json.JSONDecodeError, AttributeError, TypeError):
            continue
    print("Stdin Listener: Finished.")

# --- Main Thread: Display and Orchestration (UPDATED) ---
if __name__ == '__main__':
    print("Main Thread: Application starting.")
    
    if len(sys.argv) > 1:
        model_path_to_use = sys.argv[1]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path_to_use = os.path.join(script_dir, 'face_landmarker.task')
        print(f"WARNING: Using default model path: {model_path_to_use}")


    signal.signal(signal.SIGINT, lambda s, f: (print("\nSIGINT received, stopping."), stop_event.set()))
    
    # Pass the shared config object to the threads that need it
    CAMERA_INDEX = 0
    FRAME_READ_RETRY_DELAY = 0.05
    cam_thread = threading.Thread(target=camera_thread_func, args=(CAMERA_INDEX, FRAME_READ_RETRY_DELAY), daemon=True)
    detector_thread = threading.Thread(target=detection_and_logic_thread_func, args=(model_path_to_use, config), daemon=True)
    stdin_thread = threading.Thread(target=stdin_listener_thread_func, args=(config,), daemon=True)

    print("Main Thread: Starting all background threads...")
    cam_thread.start()
    detector_thread.start()
    stdin_thread.start()
    
    mp_drawing = mp.solutions.drawing_utils
    mp_face_mesh_module = mp.solutions.face_mesh
    DEAD_ZONE_DEGREES = 5.0 # For display only

    while not stop_event.is_set():
        try:
            display_package = result_queue.get(timeout=1)
            (frame_bgr, detection_result, 
             current_physical_yaw, current_physical_pitch, 
             wink_text_display, wink_text_timer) = display_package

            if detection_result and detection_result.face_landmarks:
                for single_face_landmarks in detection_result.face_landmarks:
                    landmark_list_pb2 = landmark_pb2.NormalizedLandmarkList()
                    landmark_list_pb2.landmark.extend([landmark_pb2.NormalizedLandmark(x=lm.x, y=lm.y, z=lm.z) for lm in single_face_landmarks])
                    mp_drawing.draw_landmarks(
                        image=frame_bgr, landmark_list=landmark_list_pb2,
                        connections=mp_face_mesh_module.FACEMESH_CONTOURS,
                        landmark_drawing_spec=mp_drawing.DrawingSpec(color=(255, 0, 0), thickness=1, circle_radius=1),
                        connection_drawing_spec=mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=1))

            yaw_status = "Moving" if abs(current_physical_yaw) > DEAD_ZONE_DEGREES else "Dead Zone"
            pitch_status = "Moving" if abs(current_physical_pitch) > DEAD_ZONE_DEGREES else "Dead Zone"
            cv2.putText(frame_bgr, f"Yaw: {current_physical_yaw:.1f} ({yaw_status})", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
            cv2.putText(frame_bgr, f"Pitch: {current_physical_pitch:.1f} ({pitch_status})", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
            
            if wink_text_display and (time.time() - wink_text_timer < 1):
                cv2.putText(frame_bgr, wink_text_display, (10, 90), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)

            cv2.imshow("Winks Head Tracking", frame_bgr)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                print("Main Thread: 'q' pressed by user.")
                stop_event.set()
                break
        except queue.Empty:
            if not detector_thread.is_alive() and not stop_event.is_set():
                print("Main Thread: Detector thread died unexpectedly.")
                stop_event.set()
            continue

    print("Main Thread: Cleaning up...")
    cv2.destroyAllWindows()
    cam_thread.join(timeout=2)
    detector_thread.join(timeout=2)
    print("Main Thread: Application finished.")