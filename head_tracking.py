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

print("head_tracking.py: Script started, imports successful.")

# --- Configuration ---
MODEL_PATH = 'face_landmarker.task'
# Sensitivity for PHYSICAL head's left/right turn (controls HORIZONTAL mouse)
SENSITIVITY_PHYSICAL_YAW = 50 # For physical L/R head turn -> horizontal mouse
# Sensitivity for PHYSICAL head's up/down tilt (controls VERTICAL mouse)
SENSITIVITY_PHYSICAL_PITCH = 50 # For physical U/D head tilt -> vertical mouse
DEAD_ZONE_DEGREES = 1
INVERT_HORIZONTAL_MOUSE = False
INVERT_VERTICAL_MOUSE = False
# --------------------

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

data_buffer = b""
payload_size = struct.calcsize("Q")

def get_frame():
    global data_buffer
    try:
        while len(data_buffer) < payload_size:
           packet = client_socket.recv(16384)
           if not packet:
              print("head_tracking.py: get_frame - Server closed connection (payload_size).")
              return None
           data_buffer += packet
        packed_msg_size = data_buffer[:payload_size]
        data_buffer = data_buffer[payload_size:]
        msg_size = struct.unpack("Q", packed_msg_size)[0]
        while len(data_buffer) < msg_size:
           packet = client_socket.recv(16384)
           if not packet:
              print("head_tracking.py: get_frame - Server closed connection (msg_size).")
              return None
           data_buffer += packet
        frame_data = data_buffer[:msg_size]
        data_buffer = data_buffer[msg_size:]
        frame = pickle.loads(frame_data)
        return frame
    except socket.error as e:
        print(f"head_tracking.py: Socket error in get_frame: {e}")
        return None
    except Exception as e:
        print(f"head_tracking.py: Generic error in get_frame: {e}")
        return None

# Modified to return:
# 1. Angle for physical yaw (from function's y_pitch_from_func)
# 2. Angle for physical pitch (NOW from function's x_roll_from_func)
def rotation_matrix_to_identified_physical_angles(rotation_matrix):
    sy = math.sqrt(rotation_matrix[0,0] * rotation_matrix[0,0] +  rotation_matrix[1,0] * rotation_matrix[1,0])
    singular = sy < 1e-6
    if not singular:
        # y_pitch_from_func is what user identified as physical yaw (L/R)
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        # x_roll_from_func is now being tested for physical pitch (U/D)
        phys_pitch_val = math.atan2(rotation_matrix[2,1] , rotation_matrix[2,2])
        # z_yaw_from_func (original physical pitch candidate, now suspected as roll) is unused for direct control
        # z_yaw_val_for_debug = math.atan2(rotation_matrix[1,0], rotation_matrix[0,0])
    else: # Singularity
        phys_yaw_val = math.atan2(-rotation_matrix[2,0], sy)
        phys_pitch_val = math.atan2(-rotation_matrix[1,2], rotation_matrix[1,1]) # Roll in singularity
        # z_yaw_val_for_debug = 0
    return math.degrees(phys_yaw_val), math.degrees(phys_pitch_val)


def main():
    global landmarker
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

    screen_width, screen_height = pyautogui.size()
    previous_physical_yaw = 0.0
    previous_physical_pitch = 0.0 # This will now track the angle used for vertical control
    first_frame = True

    mp_drawing = mp.solutions.drawing_utils
    mp_face_mesh_module = mp.solutions.face_mesh

    print("head_tracking.py: Variables for main loop initialized.")
    print("Head tracking for mouse control initialized. Press 'q' to quit.")
    print(f"Sens: PhysYaw(Horiz): {SENSITIVITY_PHYSICAL_YAW}, PhysPitch(Vert): {SENSITIVITY_PHYSICAL_PITCH}")
    print(f"Dead Zone: {DEAD_ZONE_DEGREES} degrees")
    print("head_tracking.py: Entering main processing loop...")
    frame_counter = 0

    while True:
        frame_bgr = get_frame()
        if frame_bgr is None:
            print("head_tracking.py: Received None for frame. Exiting loop.")
            break

        frame_counter += 1
        #frame_bgr = cv2.resize(frame_bgr, (640, 480))
        frame_rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=frame_rgb)

        try:
            detection_result = landmarker.detect(mp_image)
        except Exception as e:
            print(f"head_tracking.py: Error during landmarker.detect: {e}")
            continue

        mouse_dx, mouse_dy = 0, 0
        current_physical_yaw, current_physical_pitch = 0.0, 0.0 # For values used in control

        if detection_result.facial_transformation_matrixes:
            transformation_matrix = np.array(detection_result.facial_transformation_matrixes[0]).reshape(4,4)
            rotation_matrix = transformation_matrix[:3,:3]

            # Get angles:
            # current_physical_yaw is from function's "pitch" output (for L/R control)
            # current_physical_pitch is now from function's "roll" output (testing for U/D control)
            current_physical_yaw, current_physical_pitch = rotation_matrix_to_identified_physical_angles(rotation_matrix)

            if first_frame:
                previous_physical_yaw = current_physical_yaw
                previous_physical_pitch = current_physical_pitch
                first_frame = False
            else:
                delta_physical_yaw = current_physical_yaw - previous_physical_yaw
                delta_physical_pitch = current_physical_pitch - previous_physical_pitch

                if delta_physical_yaw > 180: delta_physical_yaw -= 360
                if delta_physical_yaw < -180: delta_physical_yaw += 360
                if delta_physical_pitch > 180: delta_physical_pitch -= 360
                if delta_physical_pitch < -180: delta_physical_pitch += 360

                # Physical Head Yaw (L/R turn, from func_pitch) controls Horizontal Mouse (mouse_dx)
                if abs(delta_physical_yaw) > DEAD_ZONE_DEGREES:
                    mouse_dx = -(delta_physical_yaw * SENSITIVITY_PHYSICAL_YAW)
                    if INVERT_HORIZONTAL_MOUSE:
                        mouse_dx = -mouse_dx

                # Physical Head Pitch (U/D tilt, NOW from func_roll) controls Vertical Mouse (mouse_dy)
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

        # Updated on-screen text
        cv2.putText(frame_bgr, f"Phys Yaw (from FuncPitch -> Horiz): {current_physical_yaw:.1f}", (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)
        cv2.putText(frame_bgr, f"Phys Pitch (from FuncRoll -> Vert): {current_physical_pitch:.1f}", (10, 60), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,0,255), 2)

        cv2.imshow("Head Rotation Mouse Control", frame_bgr)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            print("head_tracking.py: 'q' pressed by user. Exiting loop.")
            break

    print("head_tracking.py: Exited main processing loop.")
    if landmarker:
        print("head_tracking.py: Closing landmarker...")
        landmarker.close()
        print("head_tracking.py: Landmarker closed.")
    cv2.destroyAllWindows()
    client_socket.close()
    print("head_tracking.py: Application terminated cleanly.")
    input("head_tracking.py: Press Enter to close this window...")

if __name__ == '__main__':
    print("head_tracking.py: Script execution starting from __main__.")
    main()
    print("head_tracking.py: main() function has finished.")