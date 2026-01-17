#Head tracking without the wink detection

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import pyautogui
import numpy as np
import math
from mediapipe.framework.formats import landmark_pb2
import multiprocessing
import time
import sys
import os
import signal

# --- Configuration ---
SENSITIVITY_PHYSICAL_YAW = 55.0
SENSITIVITY_PHYSICAL_PITCH = 55.0
DEAD_ZONE_DEGREES = 6.5
MAX_JOYSTICK_TILT_ANGLE = 25.0
INVERT_HORIZONTAL_MOUSE = False
INVERT_VERTICAL_MOUSE = False

CAMERA_INDEX = 0
MAX_FRAME_READ_FAILURES = 100
FRAME_READ_RETRY_DELAY = 0.05

OPENCV_CAMERA_BACKEND = cv2.CAP_DSHOW

pyautogui.MINIMUM_DURATION = 0.0
pyautogui.MINIMUM_SLEEP = 0.0
pyautogui.PAUSE = 0.0
pyautogui.FAILSAFE = False

# --- Helper Function (Shared) ---
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

# --- Process 2: Face Detector (CRITICAL CHANGE HERE) ---
def face_detection_process(input_queue_frames, output_queue_detection, stop_event, model_path_absolute):
    print(f"Process 2 (PID: {os.getpid()}): Face Detector starting.")
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    if os.name != 'nt':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)

    landmarker = None
    try:
        base_options = python.BaseOptions(model_asset_path=model_path_absolute)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=True,
            num_faces=1)
        landmarker = vision.FaceLandmarker.create_from_options(options)
        print("Process 2: FaceLandmarker initialized successfully.")
    except Exception as e: # This handles initialization errors, which should be critical
        print(f"Process 2 CRITICAL ERROR: Error initializing FaceLandmarker: {e}")
        print(f"Process 2: Please ensure '{model_path_absolute}' is in the correct path.")
        stop_event.set() # Only set stop_event for truly critical, unrecoverable errors
        return

    try:
        while not stop_event.is_set():
            frame_data_tuple = None
            try:
                frame_data_tuple = input_queue_frames.get(timeout=0.1)
            except multiprocessing.queues.Empty:
                continue
            except Exception as e: # This handles queue-related errors, which are often critical
                print(f"Process 2: Error getting from input queue: {e}. Signalling stop.")
                stop_event.set()
                break

            if frame_data_tuple is None:
                print("Process 2: Received termination signal from Main. Exiting detection loop.")
                break

            frame_bgr, frame_counter = frame_data_tuple
            frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

            detection_result = None
            try:
                # This call will return a result (possibly with empty lists) even if no face is detected.
                detection_result = landmarker.detect(mp_image)
            except Exception as e: # Catch only errors from landmarker.detect itself, but DON'T stop the app
                print(f"Process 2: Non-critical error during landmarker.detect for frame {frame_counter}: {e}. Continuing.")
                # We do NOT set stop_event here. We just continue to the next frame.
                # detection_result will remain None if an exception occurred here.
            
            # Always put the result (even if it's None due to an exception above, or empty due to no face)
            # This ensures downstream processes don't starve.
            output_queue_detection.put((detection_result, frame_bgr)) 

    except Exception as e: # This outer generic error should be caught for true unexpected issues.
        print(f"Process 2 UNEXPECTED GENERIC ERROR: {e}. Signalling stop.")
        stop_event.set() # Signal stop only for truly unexpected, unhandled exceptions
    finally:
        if landmarker:
            print("Process 2: Closing landmarker...")
            try:
                landmarker.close()
            except Exception as e:
                print(f"Process 2: Error closing landmarker: {e}")
        print("Process 2: Face Detector finished.")
        if not stop_event.is_set():
            try:
                output_queue_detection.put(None) # Signal downstream processes
            except Exception as e:
                print(f"Process 2: Error putting None to queue: {e}")
        stop_event.set()

# --- Process 3: Mouse Controller ---
def mouse_control_process(input_queue_detection, output_queue_angles, stop_event):
    print(f"Process 3 (PID: {os.getpid()}): Mouse Controller starting (Joystick-esque).")
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    if os.name != 'nt':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)

    pyautogui.MINIMUM_DURATION = 0.0
    pyautogui.MINIMUM_SLEEP = 0.0
    pyautogui.PAUSE = 0.0

    try:
        while not stop_event.is_set():
            detection_data_tuple = None
            try:
                detection_data_tuple = input_queue_detection.get(timeout=0.1)
            except multiprocessing.queues.Empty:
                # If no detection result is available, mouse should stay stationary.
                # Continue loop to check stop_event and try again.
                output_queue_angles.put((0.0, 0.0)) # Send zero angles to keep display updated even when no face
                continue
            except Exception as e:
                print(f"Process 3: Error getting from input queue: {e}. Assuming upstream shutdown.")
                stop_event.set()
                break

            if detection_data_tuple is None:
                print("Process 3: Received termination signal from P2. Exiting mouse control loop.")
                break

            detection_result, _ = detection_data_tuple

            mouse_dx, mouse_dy = 0, 0
            current_physical_yaw, current_physical_pitch = 0.0, 0.0

            # CRITICAL: Only attempt to process detection if detection_result is not None AND has valid data
            if detection_result and detection_result.facial_transformation_matrixes:
                transformation_matrix = np.array(detection_result.facial_transformation_matrixes[0]).reshape(4,4)
                rotation_matrix = transformation_matrix[:3,:3]

                current_physical_yaw, current_physical_pitch = rotation_matrix_to_identified_physical_angles(rotation_matrix)

                if abs(current_physical_yaw) > DEAD_ZONE_DEGREES:
                    effective_yaw_tilt = current_physical_yaw - (DEAD_ZONE_DEGREES * (1 if current_physical_yaw > 0 else -1))
                    speed_factor_yaw = effective_yaw_tilt / MAX_JOYSTICK_TILT_ANGLE
                    speed_factor_yaw = max(-1.0, min(1.0, speed_factor_yaw))
                    mouse_dx = - (speed_factor_yaw * SENSITIVITY_PHYSICAL_YAW)
                    if INVERT_HORIZONTAL_MOUSE: mouse_dx = -mouse_dx
                else: mouse_dx = 0

                if abs(current_physical_pitch) > DEAD_ZONE_DEGREES:
                    effective_pitch_tilt = current_physical_pitch - (DEAD_ZONE_DEGREES * (1 if current_physical_pitch > 0 else -1))
                    speed_factor_pitch = effective_pitch_tilt / MAX_JOYSTICK_TILT_ANGLE
                    speed_factor_pitch = max(-1.0, min(1.0, speed_factor_pitch))
                    mouse_dy = speed_factor_pitch * SENSITIVITY_PHYSICAL_PITCH
                    if INVERT_VERTICAL_MOUSE: mouse_dy = -mouse_dy
                else: mouse_dy = 0
                
                # Only move mouse if there's actual non-zero movement calculated
                if mouse_dx != 0 or mouse_dy != 0:
                    pyautogui.move(int(mouse_dx), int(mouse_dy), duration=0)
            else:
                # If no face detected or detection failed, cursor should be stationary
                # Set current_physical_yaw/pitch to 0.0 for display accuracy
                current_physical_yaw, current_physical_pitch = 0.0, 0.0
                mouse_dx, mouse_dy = 0, 0 # Ensure no lingering movement instructions
                # No pyautogui.move() if no face / no valid detection

            # Always send current angles to display process, even if they are 0.0
            output_queue_angles.put((current_physical_yaw, current_physical_pitch))

    except Exception as e:
        print(f"Process 3 Generic error: {e}")
        stop_event.set() # Signal stop only for truly unexpected, unhandled exceptions
    finally:
        print("Process 3: Mouse Controller finished.")
        if not stop_event.is_set():
            try:
                output_queue_angles.put(None)
            except Exception as e:
                print(f"Process 3: Error putting None to queue: {e}")
        stop_event.set()

# --- Process 4: Display & Visualizer (Handles no detection gracefully) ---
def display_process(input_queue_detection, input_queue_angles, stop_event):
    print(f"Process 4 (PID: {os.getpid()}): Display & Visualizer starting.")
    signal.signal(signal.SIGINT, signal.SIG_IGN)
    if os.name != 'nt':
        signal.signal(signal.SIGTERM, signal.SIG_IGN)

    mp_drawing = mp.solutions.drawing_utils
    mp_face_mesh_module = mp.solutions.face_mesh
    
    current_physical_yaw = 0.0
    current_physical_pitch = 0.0

    try:
        while not stop_event.is_set():
            detection_data_tuple = None
            try:
                latest_frame_found = False
                while not input_queue_detection.empty():
                    temp_data = input_queue_detection.get_nowait()
                    if temp_data is None:
                        detection_data_tuple = None
                        latest_frame_found = True
                        break
                    detection_data_tuple = temp_data
                    latest_frame_found = True

                if detection_data_tuple is None and not latest_frame_found:
                    detection_data_tuple = input_queue_detection.get(timeout=0.1)
                    if detection_data_tuple is None:
                        print("Process 4: Received detection termination signal after blocking wait. Exiting display loop.")
                        break
            except multiprocessing.queues.Empty:
                pass # No new frame, loop back to re-check stop_event
            except Exception as e:
                print(f"Process 4: Error getting detection data from queue: {e}. Signalling stop.")
                stop_event.set()
                continue

            if detection_data_tuple is None:
                print("Process 4: Final termination signal from P2 received. Exiting display loop.")
                break

            # If detection_data_tuple is valid, process it
            if detection_data_tuple is not None:
                detection_result, frame_bgr = detection_data_tuple

                try:
                    while not input_queue_angles.empty():
                        angles_data = input_queue_angles.get_nowait()
                        if angles_data is None:
                            print("Process 4: Received angles termination signal from P3. Signaling stop.")
                            stop_event.set()
                            break
                        current_physical_yaw, current_physical_pitch = angles_data
                except multiprocessing.queues.Empty:
                    pass

                if stop_event.is_set(): break

                # CRITICAL: Only draw landmarks if detection_result is not None AND has actual face_landmarks
                if detection_result and detection_result.face_landmarks:
                    for single_face_dataclass_landmarks in detection_result.face_landmarks:
                        landmark_list_for_drawing_pb2 = landmark_pb2.NormalizedLandmarkList()
                        for dataclass_lm in single_face_dataclass_landmarks:
                            pb2_lm = landmark_pb2.NormalizedLandmark(
                                x=dataclass_lm.x, y=dataclass_lm.y, z=dataclass_lm.z)
                            if dataclass_lm.visibility is not None: pb2_lm.visibility = dataclass_lm.visibility
                            if dataclass_lm.presence is not None: pb2_lm.presence = dataclass_lm.presence
                            landmark_list_for_drawing_pb2.landmark.append(pb2_lm)
                        
                        if hasattr(mp_face_mesh_module, 'FACEMESH_CONTOURS'):
                            mp_drawing.draw_landmarks(
                                image=frame_bgr, landmark_list=landmark_list_for_drawing_pb2,
                                connections=mp_face_mesh_module.FACEMESH_CONTOURS,
                                landmark_drawing_spec=mp_drawing.DrawingSpec(color=(255,0,0), thickness=1, circle_radius=1),
                                connection_drawing_spec=mp_drawing.DrawingSpec(color=(0,255,0), thickness=1, circle_radius=1))
                else:
                    # If no face detected, still display the frame but without landmarks
                    pass # frame_bgr will contain the raw camera image

                yaw_status = "Moving" if abs(current_physical_yaw) > DEAD_ZONE_DEGREES else "Dead Zone"
                pitch_status = "Moving" if abs(current_physical_pitch) > DEAD_ZONE_DEGREES else "Dead Zone"

                cv2.putText(frame_bgr, f"Phys Yaw (Horiz): {current_physical_yaw:.1f} ({yaw_status})", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
                cv2.putText(frame_bgr, f"Phys Pitch (Vert): {current_physical_pitch:.1f} ({pitch_status})", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

                cv2.imshow("Head Rotation Mouse Control", frame_bgr)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    print("Process 4: 'q' pressed by user. Signaling stop.")
                    stop_event.set()
                    break
            
            else: # If detection_data_tuple was None initially, it means a termination signal from P2
                pass # Already handled by the 'if detection_data_tuple is None' at the top of the loop

    except Exception as e:
        print(f"Process 4 Generic error: {e}")
        stop_event.set() # Signal stop only for truly unexpected, unhandled exceptions
    finally:
        print("Process 4: Destroying all windows.")
        cv2.destroyAllWindows()
        print("Process 4: Display & Visualizer finished.")
        stop_event.set()

# --- Main Program Orchestrator ---
def main_orchestrator(model_path_from_args):
    print("Main process: Starting head_tracking application with multiprocessing.")
    process_id = os.getpid()

    stop_event = multiprocessing.Event()
    
    def sigint_handler(signum, frame):
        print(f"\nMain process (PID: {process_id}): SIGINT received. Signaling all processes to stop.")
        stop_event.set()
    
    signal.signal(signal.SIGINT, sigint_handler)
    if os.name != 'nt':
        signal.signal(signal.SIGTERM, sigint_handler)

    queue_frames_to_detector = multiprocessing.Queue(maxsize=20)
    queue_detection_to_mouse_display = multiprocessing.Queue(maxsize=5)
    queue_angles_to_display = multiprocessing.Queue(maxsize=1)

    p2_face_detector = multiprocessing.Process(
        target=face_detection_process,
        args=(queue_frames_to_detector, queue_detection_to_mouse_display, stop_event, model_path_from_args)
    )
    p3_mouse_controller = multiprocessing.Process(
        target=mouse_control_process,
        args=(queue_detection_to_mouse_display, queue_angles_to_display, stop_event)
    )
    p4_display_visualizer = multiprocessing.Process(
        target=display_process,
        args=(queue_detection_to_mouse_display, queue_angles_to_display, stop_event)
    )

    p2_face_detector.start()
    p3_mouse_controller.start()
    p4_display_visualizer.start()

    print(f"Main process (PID: {process_id}): All child processes started. Initializing camera.")

    cap = None
    frame_read_failures = 0
    try:
        cap = cv2.VideoCapture(CAMERA_INDEX, OPENCV_CAMERA_BACKEND)
        if not cap.isOpened():
            print(f"Main process ERROR (PID: {process_id}): Could not open video device {CAMERA_INDEX} with backend {OPENCV_CAMERA_BACKEND}.")
            stop_event.set()
        else:
            print(f"Main process (PID: {process_id}): Camera opened successfully. Starting frame capture.")
            frame_counter = 0
            
            while not stop_event.is_set():
                ret, frame_bgr = cap.read()
                if not ret:
                    frame_read_failures += 1
                    print(f"Main process (PID: {process_id}): Failed to grab frame (attempt {frame_read_failures}/{MAX_FRAME_READ_FAILURES}).")
                    if frame_read_failures >= MAX_FRAME_READ_FAILURES:
                        print(f"Main process (PID: {process_id}): Max frame read failures reached. Exiting camera capture loop.")
                        stop_event.set()
                        break
                    time.sleep(FRAME_READ_RETRY_DELAY)
                    continue

                frame_read_failures = 0

                try:
                    queue_frames_to_detector.put((frame_bgr, frame_counter))
                except Exception as e:
                    print(f"Main process (PID: {process_id}): Error putting frame to queue: {e}. Assuming child process stopped.")
                    stop_event.set()
                    break
                
                frame_counter += 1
                time.sleep(0.001)

    except Exception as e:
        print(f"Main process Generic error (PID: {process_id}) during frame capture: {e}")
        stop_event.set()
    finally:
        print(f"Main process (PID: {process_id}): Entering camera cleanup block.")
        if cap is not None and cap.isOpened():
            print(f"Main process (PID: {process_id}): Attempting to release camera.")
            cap.release()
            print(f"Main process (PID: {process_id}): Camera release command issued.")
        else:
            print(f"Main process (PID: {process_id}): Camera was not opened or already released.")
        
        if not stop_event.is_set():
            try:
                queue_frames_to_detector.put(None)
                print(f"Main process: Sent final None to queue_frames_to_detector.")
            except Exception as e:
                print(f"Main process: Error putting None to queue_frames_to_detector during final shutdown: {e}")

        stop_event.set()
        print(f"Main process (PID: {process_id}): Camera capture loop finished.")

    print(f"Main process (PID: {process_id}): Waiting for child processes to finish...")
    
    p2_face_detector.join(timeout=3)
    p3_mouse_controller.join(timeout=3)
    p4_display_visualizer.join(timeout=3)

    if p2_face_detector.is_alive():
        print(f"Main process (PID: {process_id}): P2 still alive after join timeout, terminating.")
        p2_face_detector.terminate()
    if p3_mouse_controller.is_alive():
        print(f"Main process (PID: {process_id}): P3 still alive after join timeout, terminating.")
        p3_mouse_controller.terminate()
    if p4_display_visualizer.is_alive():
        print(f"Main process (PID: {process_id}): P4 still alive after join timeout, terminating.")
        p4_display_visualizer.terminate()

    print(f"Main process (PID: {process_id}): All child processes handled. Application terminated cleanly.")

if __name__ == '__main__':
    model_path_to_use = None
    if len(sys.argv) > 1:
        model_path_to_use = sys.argv[1]
    else:
        script_dir = os.path.dirname(os.path.abspath(__file__))
        model_path_to_use = os.path.join(script_dir, 'face_landmarker.task')
        print(f"WARNING: No model path provided as argument. Using default for standalone: {model_path_to_use}")

    multiprocessing.freeze_support()
    main_orchestrator(model_path_to_use)