# detector_process.py

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import math
import sys
import os
import signal
import multiprocessing # For the queues.Empty exception

# This helper function is needed by face_detection_process
def calculate_ear(landmarks, eye_points):
    """Calculate the eye aspect ratio to detect winks."""
    if not landmarks or max(eye_points) >= len(landmarks):
        return 999.0

    p1, p2, p3, p4, p5, p6 = [landmarks[i] for i in eye_points]

    if any(lm is None for lm in [p1,p2,p3,p4,p5,p6]):
        return 999.0

    try:
        top_y = (p2.y + p3.y) / 2
        bottom_y = (p5.y + p6.y) / 2
        
        horizontal_dist = p4.x - p1.x
        if horizontal_dist == 0:
            return 999.0
        
        ear = abs(bottom_y - top_y) / abs(horizontal_dist)
        return ear
    except:
        return 999.0

# This is the exact same function from your main script
def face_detection_process(input_queue_frames, output_queue_detection, stop_event, model_path_absolute, p2_ready_event):
    print(f"Process 2 (PID: {os.getpid()}) from detector_process.py: Starting initialization.")
    sys.stdout.flush()
    
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
        sys.stdout.flush()
        
        p2_ready_event.set()
        print(f"Process 2: Signalled p2_ready_event.set().")
        sys.stdout.flush()
        
    except Exception as e:
        print(f"Process 2 CRITICAL ERROR in init: {e}")
        import traceback
        traceback.print_exc()
        sys.stdout.flush()
        stop_event.set()
        p2_ready_event.set() 
        return

    try:
        while not stop_event.is_set():
            try:
                frame_data_tuple = input_queue_frames.get(timeout=0.1)
                if frame_data_tuple is None:
                    break
                    
                frame_bgr, frame_counter = frame_data_tuple
                frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)
                detection_result = landmarker.detect(mp_image)
                output_queue_detection.put((detection_result, frame_bgr))

            except multiprocessing.queues.Empty:
                continue
            except Exception as e:
                print(f"Process 2: Error in loop: {e}. Signalling stop.")
                stop_event.set()
                break
                
    finally:
        if landmarker:
            landmarker.close()
        print("Process 2: Face Detector finished.")
        sys.stdout.flush()