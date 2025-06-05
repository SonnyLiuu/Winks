import cv2
import mediapipe as mp
import numpy as np
import time
import pyautogui # For mouse control
import math
import socket # For network communication
import struct # For network communication
import pickle # For network communication
import threading # For network communication

# --- PyAutoGUI Optimizations ---
pyautogui.MINIMUM_DURATION = 0.0
pyautogui.MINIMUM_SLEEP = 0.0
pyautogui.PAUSE = 0.0
# --- End PyAutoGUI Optimizations ---

# --- Configuration ---
SENSITIVITY_PHYSICAL_YAW = 400   # For physical L/R head turn -> horizontal mouse
SENSITIVITY_PHYSICAL_PITCH = 400 # For physical U/D head tilt -> vertical mouse (currently off)
DEAD_ZONE_DEGREES_X = 0.1       # Dead zone for horizontal mouse axis (Yaw)
DEAD_ZONE_DEGREES_Y = 0.1        # Dead zone for vertical mouse axis (Pitch)
INVERT_HORIZONTAL_MOUSE = False
INVERT_VERTICAL_MOUSE = False
ENABLE_MOUSE_MOVEMENT = True
INITIAL_YAW_ACCEPTANCE_THRESHOLD = -1.0 # Raw yaw must be <= this on first frame to be accepted
# --- End Configuration ---

# --- Globals for Threaded Frame Reception ---
latest_frame_from_socket = None
frame_lock = threading.Lock()
network_thread_should_run = True
# --- End Globals for Threaded Frame Reception ---

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(min_detection_confidence=0.5, min_tracking_confidence=0.5)

# Drawing utilities
mp_drawing = mp.solutions.drawing_utils
drawing_spec = mp_drawing.DrawingSpec(thickness=1, circle_radius=1)

# --- Network Setup ---
client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    print(f"Connecting to server at 127.0.0.1:5555...")
    client_socket.connect(('127.0.0.1', 5555))
    print("Connected to server successfully.")
except ConnectionRefusedError:
    print("CLIENT ERROR - Connection refused. Make sure the camera_feed.py server script is running.")
    input("Press Enter to exit...")
    exit()
except Exception as e:
    print(f"CLIENT ERROR - Unexpected error during socket connection: {e}")
    input("Press Enter to exit...")
    exit()
# --- End Network Setup ---


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
                        print("Network Thread: Server closed connection (recv returned empty during header).")
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
                    bytes_to_read = min(16384, msg_size - len(thread_data_buffer)) # Read up to 16KB or remaining
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

            decoded_frame = pickle.loads(frame_data_bytes) # Using pickle as per server

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


def main():
    global latest_frame_from_socket, frame_lock, network_thread_should_run

    # Variables for mouse control logic
    previous_physical_yaw = 0.0
    previous_physical_pitch = 0.0
    first_frame_processed = True # True until a "good" initial pose is set

    # For solvePnP stabilization
    rot_vec_prev = None
    trans_vec_prev = None
    pnp_initial_solve = True

    # Start the network receiver thread
    print("Main Thread: Starting network receiver thread...")
    receiver_thread = threading.Thread(target=network_receive_thread_func, args=(client_socket,))
    receiver_thread.daemon = True
    receiver_thread.start()


    print("Head Pose Estimation with Mouse Control. Press ESC to quit.")
    print(f"Initial orientation check: Raw Yaw must be <= {INITIAL_YAW_ACCEPTANCE_THRESHOLD} to start.")
    print(f"Sens: Yaw(Horiz): {SENSITIVITY_PHYSICAL_YAW}, Pitch(Vert): {SENSITIVITY_PHYSICAL_PITCH}")
    print(f"Dead Zone X (Yaw): {DEAD_ZONE_DEGREES_X}, Y (Pitch): {DEAD_ZONE_DEGREES_Y}")


    processed_frame_counter = 0
    fps_display_val = 0
    fps_start_time = time.time()
    fps_update_interval = 1.0

    window_name = "Head Pose Estimation with Mouse Control"
    # cv2.namedWindow(window_name) # Create window once a frame is available

    first_display_frame = True # To create window on first actual frame

    while network_thread_should_run:
        current_frame_for_processing = None
        with frame_lock:
            if latest_frame_from_socket is not None:
                current_frame_for_processing = latest_frame_from_socket.copy()
                # latest_frame_from_socket = None # Optional: Consume the frame if processing every single one received by thread

        if not network_thread_should_run:
            print("Main Thread: Network thread signalled stop. Exiting loop.")
            break

        if current_frame_for_processing is None:
            # If window exists, process its events. If not, just sleep.
            if not first_display_frame:
                key = cv2.waitKey(1) & 0xFF
                if key == 27: # ESC
                    print("Main Thread: ESC pressed. Signalling network thread to stop.")
                    network_thread_should_run = False
                    break
                if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1 and processed_frame_counter > 0:
                    print("Main Thread: Window closed. Signalling network thread to stop.")
                    network_thread_should_run = False
                    break
            time.sleep(0.001) # Small sleep to yield CPU if no frame
            continue

        # --- Start of processing logic from your baseline ---
        image = current_frame_for_processing # This is already a BGR frame from pickle

        if first_display_frame:
            cv2.namedWindow(window_name)
            first_display_frame = False

        start_perf_time = time.perf_counter() # Start timing for this frame's processing

        image_for_mp = cv2.cvtColor(cv2.flip(image, 1), cv2.COLOR_BGR2RGB)
        output_image = cv2.flip(image.copy(), 1) # For drawing

        image_for_mp.flags.writeable = False
        results = face_mesh.process(image_for_mp)
        image_for_mp.flags.writeable = True

        img_h, img_w, img_c = output_image.shape

        mouse_dx, mouse_dy = 0.0, 0.0
        current_physical_yaw_from_pnp, current_physical_pitch_from_pnp = 0.0, 0.0

        text = "Forward"
        if first_frame_processed:
            text = f"Initializing... (Raw Yaw <= {INITIAL_YAW_ACCEPTANCE_THRESHOLD}?)"

        display_pitch_from_decomp, display_yaw_from_decomp, display_roll_from_decomp = 0.0, 0.0, 0.0
        nose_2d_for_line = None

        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                face_2d_current_face = []
                face_3d_current_face = []
                selected_landmark_indices = [1, 33, 263, 61, 291, 199]
                for idx, lm in enumerate(face_landmarks.landmark):
                    if idx in selected_landmark_indices:
                        if idx == 1:
                            nose_2d_for_line = (lm.x * img_w, lm.y * img_h)
                        x_coord, y_coord = int(lm.x * img_w), int(lm.y * img_h)
                        face_2d_current_face.append([x_coord, y_coord])
                        face_3d_current_face.append([x_coord, y_coord, lm.z * 100])

                if len(face_2d_current_face) == len(selected_landmark_indices):
                    face_2d_np = np.array(face_2d_current_face, dtype=np.float64)
                    face_3d_np = np.array(face_3d_current_face, dtype=np.float64)
                    focal_length = img_w
                    cam_matrix = np.array([ [focal_length, 0, img_w / 2],
                                            [0, focal_length, img_h / 2],
                                            [0, 0, 1]])
                    dist_matrix = np.zeros((4, 1), dtype=np.float64)

                    if pnp_initial_solve or rot_vec_prev is None:
                        success_pnp, rot_vec, trans_vec = cv2.solvePnP(face_3d_np, face_2d_np, cam_matrix, dist_matrix)
                        if success_pnp:
                            rot_vec_prev, trans_vec_prev = rot_vec, trans_vec
                            pnp_initial_solve = False
                    else:
                        success_pnp, rot_vec, trans_vec = cv2.solvePnP(face_3d_np, face_2d_np, cam_matrix, dist_matrix,
                                                                      rvec=rot_vec_prev, tvec=trans_vec_prev, useExtrinsicGuess=True)
                        if success_pnp:
                             rot_vec_prev, trans_vec_prev = rot_vec, trans_vec
                        else:
                            success_pnp, rot_vec, trans_vec = cv2.solvePnP(face_3d_np, face_2d_np, cam_matrix, dist_matrix)
                            if success_pnp:
                                rot_vec_prev, trans_vec_prev = rot_vec, trans_vec
                                pnp_initial_solve = False

                    if success_pnp:
                        rmat, _ = cv2.Rodrigues(rot_vec)
                        angles_decomp, _, _, _, _, _ = cv2.RQDecomp3x3(rmat)
                        current_physical_pitch_from_pnp = angles_decomp[0]
                        current_physical_yaw_from_pnp = angles_decomp[1]
                        roll_from_decomp = angles_decomp[2]
                        display_pitch_from_decomp = current_physical_pitch_from_pnp
                        display_yaw_from_decomp = current_physical_yaw_from_pnp
                        display_roll_from_decomp = roll_from_decomp

                        if first_frame_processed:
                            if False: #INITIAL_YAW_ACCEPTANCE_THRESHOLD
                                print(f"--- INITIAL ORIENTATION REJECTED (Raw Yaw {current_physical_yaw_from_pnp:.2f} > {INITIAL_YAW_ACCEPTANCE_THRESHOLD}). Retrying PnP. ---")
                                pnp_initial_solve = True
                                rot_vec_prev, trans_vec_prev = None, None
                                text = "Bad Init. Retrying..."
                            else:
                                print(f"--- INITIAL ORIENTATION ACCEPTED (Raw Yaw {current_physical_yaw_from_pnp:.2f} <= {INITIAL_YAW_ACCEPTANCE_THRESHOLD}). Setting reference. ---")
                                previous_physical_yaw = current_physical_yaw_from_pnp
                                previous_physical_pitch = current_physical_pitch_from_pnp
                                first_frame_processed = False
                                text = "Reference Set! Forward."

                        if not first_frame_processed:
                            delta_physical_yaw = current_physical_yaw_from_pnp - previous_physical_yaw
                            delta_physical_pitch = current_physical_pitch_from_pnp - previous_physical_pitch
                            if delta_physical_yaw > 180: delta_physical_yaw -= 360
                            if delta_physical_yaw < -180: delta_physical_yaw += 360
                            if delta_physical_pitch > 180: delta_physical_pitch -= 360
                            if delta_physical_pitch < -180: delta_physical_pitch += 360

                            if abs(delta_physical_yaw) > DEAD_ZONE_DEGREES_X: # Using X for Yaw
                                mouse_dx = delta_physical_yaw * SENSITIVITY_PHYSICAL_YAW # Your updated logic
                                if INVERT_HORIZONTAL_MOUSE:
                                    mouse_dx = -mouse_dx
                            if abs(delta_physical_pitch) > DEAD_ZONE_DEGREES_Y: # Using Y for Pitch
                                mouse_dy = -(delta_physical_pitch * SENSITIVITY_PHYSICAL_PITCH)
                                if INVERT_VERTICAL_MOUSE:
                                    mouse_dy = -mouse_dy

                            previous_physical_yaw = current_physical_yaw_from_pnp
                            previous_physical_pitch = current_physical_pitch_from_pnp

                            if not text == "Reference Set! Forward." and not text == "Bad Init. Retrying...":
                                if current_physical_yaw_from_pnp < -10: text = "Looking Left"
                                elif current_physical_yaw_from_pnp > 10: text = "Looking Right"
                                elif current_physical_pitch_from_pnp < -10: text = "Looking Down"
                                elif current_physical_pitch_from_pnp > 10: text = "Looking Up"
                                else: text = "Forward"
                        if nose_2d_for_line is not None:
                            p1_line = (int(nose_2d_for_line[0]), int(nose_2d_for_line[1]))
                            line_p2_x = int(nose_2d_for_line[0] + current_physical_yaw_from_pnp * 1.5)
                            line_p2_y = int(nose_2d_for_line[1] - current_physical_pitch_from_pnp * 1.5)
                            cv2.line(output_image, p1_line, (line_p2_x, line_p2_y), (255, 0, 0), 3)
                mp_drawing.draw_landmarks(
                    image=output_image, landmark_list=face_landmarks,
                    connections=mp_face_mesh.FACEMESH_CONTOURS,
                    landmark_drawing_spec=drawing_spec, connection_drawing_spec=drawing_spec)
                break

        if ENABLE_MOUSE_MOVEMENT and not first_frame_processed:
            if mouse_dx != 0 or mouse_dy != 0:
                pyautogui.move(int(mouse_dx), int(mouse_dy), duration=0)

        processed_frame_counter +=1 # Moved from your original FPS block to count actual main loop iterations

        current_loop_time = time.perf_counter()
        elapsed_time_fps = current_loop_time - fps_start_time
        if elapsed_time_fps > fps_update_interval:
            fps_display_val = processed_frame_counter / elapsed_time_fps
            fps_start_time = current_loop_time
            processed_frame_counter = 0

        cv2.putText(output_image, text, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
        cv2.putText(output_image, f"RawPitch(X): {display_pitch_from_decomp:.1f}", (img_w - 220, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        cv2.putText(output_image, f"RawYaw(Y): {display_yaw_from_decomp:.1f}", (img_w - 220, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 1)
        cv2.putText(output_image, f"FPS: {int(fps_display_val)}", (20, img_h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0,255,0), 2)

        cv2.imshow(window_name, output_image)
        key = cv2.waitKey(1) & 0xFF # Changed from 5 to 1 for potentially better responsiveness
        if key == 27:
            print("Main Thread: ESC pressed. Signalling network thread to stop.")
            network_thread_should_run = False; break
        if cv2.getWindowProperty(window_name, cv2.WND_PROP_VISIBLE) < 1 and processed_frame_counter > 0:
            print("Main Thread: Window closed. Signalling network thread to stop.")
            network_thread_should_run = False; break

        if not receiver_thread.is_alive() and network_thread_should_run :
             print("Main Thread: Network thread died unexpectedly. Exiting.")
             network_thread_should_run = False; break

    print("head_tracking.py: Exited main processing loop.")
    network_thread_should_run = False
    if receiver_thread.is_alive():
        print("Main Thread: Waiting for network receiver thread to join..."); receiver_thread.join(timeout=2.0)
        if receiver_thread.is_alive(): print("Main Thread: Network thread did not join in time.")
    else: print("Main Thread: Network thread already finished.")
    if client_socket: client_socket.close() # Close the socket
    # cap.release() # No longer using cap directly in main
    cv2.destroyAllWindows()
    print("Application terminated.")

if __name__ == '__main__':
    print("head_tracking.py: Script execution starting from __main__.")
    main()
    print("head_tracking.py: main() function has finished.")
