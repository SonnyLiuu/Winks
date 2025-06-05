import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
import pyautogui
import socket
import struct
import pickle
import numpy as np
import math
from mediapipe.framework.formats import landmark_pb2
import threading
import time

print("head_tracking.py: Script started, imports successful.")

# --- Configuration (matches your last provided settings) ---
MODEL_PATH = 'face_landmarker.task'
SENSITIVITY_PHYSICAL_YAW = 100 # For physical L/R head turn -> horizontal mouse
SENSITIVITY_PHYSICAL_PITCH = 100 # For physical U/D head tilt -> vertical mouse
DEAD_ZONE_DEGREES = .1 # As per your "perfect horizontal" setup
INVERT_HORIZONTAL_MOUSE = False # As per your "perfect horizontal" setup
INVERT_VERTICAL_MOUSE = False   # As per your "perfect horizontal" setup
# --------------------

# --- Globals for Threaded Frame Reception ---
latest_frame_from_socket = None
frame_lock = threading.Lock()
network_thread_should_run = True
# --------------------------------------------

landmarker = None
print("head_tracking.py: Global variables initialized.")

client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    print(f"head_tracking.py: Attempting to connect to server at 127.0.0.1:5555...")
    client_socket.connect(('127.0.0.1', 5555))
    print("head_tracking.py: Connected to server successfully.")
except ConnectionRefusedError:
    print("head_tracking.py: CLIENT ERROR - Connection refused. Make sure the server script is running.")
    input("head_tracking.py: Press Enter to exit...")
    exit()
except Exception as e:
    print(f"head_tracking.py: CLIENT ERROR - Unexpected error during socket connection: {e}")
    input("head_tracking.py: Press Enter to exit...")
    exit()


def network_receive_thread_func(sock):
    """
    Thread function to continuously receive frames from the socket
    and update the latest_frame_from_socket global variable.
    """
    global latest_frame_from_socket, frame_lock, network_thread_should_run

    thread_data_buffer = b""
    thread_payload_size = struct.calcsize("Q")

    sock.settimeout(0.5)

    print("Network Thread: Started.")
    while network_thread_should_run:
        try:
            while len(thread_data_buffer) < thread_payload_size:
                if not network_thread_should_run: break
                try:
                    packet = sock.recv(4096)
                    if not packet:
                        print("Network Thread: Server closed connection (recv returned empty).")
                        network_thread_should_run = False
                        break
                    thread_data_buffer += packet
                except socket.timeout:
                    continue
                except socket.error as e:
                    print(f"Network Thread: Socket error during header recv: {e}")
                    network_thread_should_run = False
                    break
            if not network_thread_should_run: break
            if len(thread_data_buffer) < thread_payload_size: continue

            packed_msg_size = thread_data_buffer[:thread_payload_size]
            thread_data_buffer = thread_data_buffer[thread_payload_size:]
            msg_size = struct.unpack("Q", packed_msg_size)[0]

            while len(thread_data_buffer) < msg_size:
                if not network_thread_should_run: break
                try:
                    bytes_to_read = min(4096 * 4, msg_size - len(thread_data_buffer))
                    packet = sock.recv(bytes_to_read)
                    if not packet:
                        print("Network Thread: Server closed connection (recv returned empty during data).")
                        network_thread_should_run = False
                        break
                    thread_data_buffer += packet
                except socket.timeout:
                    continue
                except socket.error as e:
                    print(f"Network Thread: Socket error during data recv: {e}")
                    network_thread_should_run = False
                    break
            if not network_thread_should_run: break
            if len(thread_data_buffer) < msg_size: continue

            frame_data_bytes = thread_data_buffer[:msg_size]
            thread_data_buffer = thread_data_buffer[msg_size:]

            decoded_frame = pickle.loads(frame_data_bytes) # Assuming server still sends pickle

            with frame_lock:
                latest_frame_from_socket = decoded_frame

        except struct.error as e:
            print(f"Network Thread: Struct unpack error: {e}")
            thread_data_buffer = b""
            continue
        except pickle.UnpicklingError as e:
            print(f"Network Thread: Pickle unpickling error: {e}")
            thread_data_buffer = b""
            continue
        except Exception as e:
            print(f"Network Thread: Generic error: {e}")
            time.sleep(0.1)

    print("Network Thread: Exiting.")


def rotation_matrix_to_identified_physical_angles(rotation_matrix):
    sy = math.sqrt(rotation_matrix[0,0] * rotation_matrix[0,0] +  rotation_matrix[1,0] * rotation_matrix[1,0])
    singular = sy < 1e-6
    if not singular:
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        phys_pitch_val = math.atan2(rotation_matrix[2,1] , rotation_matrix[2,2])
    else:
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        phys_pitch_val = math.atan2(-rotation_matrix[1,2], rotation_matrix[1,1])
    return math.degrees(phys_yaw_val), math.degrees(phys_pitch_val)


def main():
    global landmarker, latest_frame_from_socket, frame_lock, network_thread_should_run

    print("head_tracking.py: main() function started.")
    try:
        print(f"head_tracking.py: Attempting to initialize FaceLandmarker with MODEL_PATH: '{MODEL_PATH}'")
        base_options = python.BaseOptions(model_asset_path=MODEL_PATH)
        options = vision.FaceLandmarkerOptions(
            base_options=base_options,
            output_face_blendshapes=False,
            output_facial_transformation_matrixes=True,
            num_faces=1)
        landmarker = vision.FaceLandmarker.create_from_options(options)
        print("head_tracking.py: FaceLandmarker initialized successfully.")
    except Exception as e:
        print(f"head_tracking.py: CLIENT CRITICAL ERROR - Error initializing FaceLandmarker: {e}")
        print("head_tracking.py: Please ensure 'face_landmarker.task' is in the correct path.")
        input("head_tracking.py: Press Enter to exit...")
        return

    print("Main Thread: Starting network receiver thread...")
    receiver_thread = threading.Thread(target=network_receive_thread_func, args=(client_socket,))
    receiver_thread.daemon = True
    receiver_thread.start()

    previous_physical_yaw = 0.0
    previous_physical_pitch = 0.0
    first_frame_processed = True

    mp_drawing = mp.solutions.drawing_utils
    mp_face_mesh_module = mp.solutions.face_mesh

    print("head_tracking.py: Variables for main loop initialized.")
    print("Head tracking for mouse control initialized. Press 'q' to quit.")
    print(f"Sens: PhysYaw(Horiz): {SENSITIVITY_PHYSICAL_YAW}, PhysPitch(Vert): {SENSITIVITY_PHYSICAL_PITCH}")
    print(f"Dead Zone: {DEAD_ZONE_DEGREES} degrees")
    print("head_tracking.py: Entering main processing loop...")

    processed_frame_counter_for_fps = 0 # For FPS calculation
    fps_display_val = 0 # FPS value to display
    fps_start_time = time.time()
    fps_update_interval = 1.0 # Update FPS display every 1 second

    window_name = "Head Rotation Mouse Control"
    cv2.namedWindow(window_name)


    while network_thread_should_run:
        current_frame_for_processing = None
        with frame_lock:
            if latest_frame_from_socket is not None:
                current_frame_for_processing = latest_frame_from_socket.copy()

        if not network_thread_should_run:
            print("Main Thread: Network thread signalled stop. Exiting loop.")
            break

        if current_frame_for_processing is None:
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("Main Thread: 'q' pressed. Signalling network thread to stop.")
                network_thread_should_run = False
                break
            if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1 and processed_frame_counter_for_fps > 0:
                print("Main Thread: Window closed. Signalling network thread to stop.")
                network_thread_should_run = False
                break
            time.sleep(0.001)
            continue

        frame_bgr = current_frame_for_processing

        # Increment frame counter for FPS calculation
        processed_frame_counter_for_fps += 1

        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)

        if processed_frame_counter_for_fps % 60 == 1: # Print shape occasionally (frame 1, 61, 121...)
            print(f"head_tracking.py: Processing frame - Shape: {frame_rgb.shape}")

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        try:
            detection_result = landmarker.detect(mp_image)
        except Exception as e:
            print(f"head_tracking.py: Error during landmarker.detect: {e}")
            continue

        mouse_dx, mouse_dy = 0.0, 0.0
        current_physical_yaw, current_physical_pitch = 0.0, 0.0

        if detection_result.facial_transformation_matrixes:
            transformation_matrix = np.array(detection_result.facial_transformation_matrixes[0]).reshape(4,4)
            rotation_matrix = transformation_matrix[:3,:3]
            current_physical_yaw, current_physical_pitch = rotation_matrix_to_identified_physical_angles(rotation_matrix)

            if first_frame_processed:
                previous_physical_yaw = current_physical_yaw
                previous_physical_pitch = current_physical_pitch
                first_frame_processed = False
            else:
                delta_physical_yaw = current_physical_yaw - previous_physical_yaw
                delta_physical_pitch = current_physical_pitch - previous_physical_pitch

                if delta_physical_yaw > 180: delta_physical_yaw -= 360
                if delta_physical_yaw < -180: delta_physical_yaw += 360
                if delta_physical_pitch > 180: delta_physical_pitch -= 360
                if delta_physical_pitch < -180: delta_physical_pitch += 360

                if abs(delta_physical_yaw) > DEAD_ZONE_DEGREES:
                    mouse_dx = -(delta_physical_yaw * SENSITIVITY_PHYSICAL_YAW)
                    if INVERT_HORIZONTAL_MOUSE:
                        mouse_dx = -mouse_dx

                if abs(delta_physical_pitch) > DEAD_ZONE_DEGREES:
                    mouse_dy = delta_physical_pitch * SENSITIVITY_PHYSICAL_PITCH
                    if INVERT_VERTICAL_MOUSE:
                        mouse_dy = -mouse_dy

            previous_physical_yaw = current_physical_yaw
            previous_physical_pitch = current_physical_pitch

        if mouse_dx != 0 or mouse_dy != 0:
            pyautogui.move(int(mouse_dx), int(mouse_dy), duration=0)

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

        # --- FPS Calculation and Display ---
        current_time = time.time()
        elapsed_time = current_time - fps_start_time
        if elapsed_time > fps_update_interval:
            fps_display_val = processed_frame_counter_for_fps / elapsed_time
            fps_start_time = current_time
            processed_frame_counter_for_fps = 0 # Reset frame count for next interval

        cv2.putText(frame_bgr, f"FPS: {fps_display_val:.1f}", (frame_bgr.shape[1] - 100, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)
        # --- End FPS ---

        cv2.putText(frame_bgr, f"Phys Yaw (FuncPitch -> Horiz): {current_physical_yaw:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
        cv2.putText(frame_bgr, f"Phys Pitch (FuncRoll -> Vert): {current_physical_pitch:.1f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

        cv2.imshow(window_name, frame_bgr)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            print("Main Thread: 'q' pressed. Signalling network thread to stop.")
            network_thread_should_run = False
            break
        # Check if window was closed by user using the 'X' button
        # cv2.getWindowProperty returns -1 if window is destroyed.
        # Check processed_frame_counter_for_fps > 0 to avoid exiting on first loop if window not up yet.
        if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1 and processed_frame_counter_for_fps > 0 :
            print("Main Thread: Window closed by user. Signalling network thread to stop.")
            network_thread_should_run = False
            break


    print("head_tracking.py: Exited main processing loop.")

    network_thread_should_run = False
    if receiver_thread.is_alive():
        print("Main Thread: Waiting for network receiver thread to join...")
        receiver_thread.join(timeout=1.5)
        if receiver_thread.is_alive():
            print("Main Thread: Network thread did not join in time.")
    else:
        print("Main Thread: Network thread already finished.")

    if landmarker:
        print("head_tracking.py: Closing landmarker...")
        landmarker.close()
        print("head_tracking.py: Landmarker closed.")
    cv2.destroyAllWindows()
    client_socket.close()
    print("head_tracking.py: Application terminated cleanly.")

if __name__ == '__main__':
    print("head_tracking.py: Script execution starting from __main__.")
    main()
    print("head_tracking.py: main() function has finished.")
