import cv2
import mediapipe as mp
import pyautogui
import socket
import struct
import pickle

# Create and connect the client socket
client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
client_socket.connect(('127.0.0.1', 5555))

data_buffer = b""
payload_size = struct.calcsize("Q")  # 8 bytes for frame length header

def get_frame():
	global data_buffer
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

	# Wait until the entire frame is received.
	while len(data_buffer) < msg_size:
		packet = client_socket.recv(16384)
		if not packet:
			return None
		data_buffer += packet

	frame_data = data_buffer[:msg_size]
	data_buffer = data_buffer[msg_size:]
	# Convert the JPEG byte stream to a NumPy array and decode
	frame = pickle.loads(frame_data)
	return frame

def main():
	# Initialize MediaPipe Face Mesh and drawing utilities.
	mp_face_mesh = mp.solutions.face_mesh
	mp_drawing = mp.solutions.drawing_utils
	face_mesh = mp_face_mesh.FaceMesh(
	    min_detection_confidence=0.5,
	    min_tracking_confidence=0.5
	)
	
	# Get screen dimensions for mouse control.
	screen_width, screen_height = pyautogui.size()

	# Store the initial nose position (neutral point) and set sensitivity.
	neutral_nose_x, neutral_nose_y = None, None
	sensitivity = 10

	while True:
		frame = get_frame()
		if frame is None:
			print("Disconnected or no more frames.")
			break

		# Downscale the frame to 480p (640x480)
		frame = cv2.resize(frame, (640, 480))

		# Convert frame from BGR (OpenCV default) to RGB (for MediaPipe)
		rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
		results = face_mesh.process(rgb_frame)

		# Process landmarks if detected.
		if results.multi_face_landmarks:
			for face_landmarks in results.multi_face_landmarks:
				# Optionally draw the facial mesh on the frame.
				mp_drawing.draw_landmarks(frame, face_landmarks, mp_face_mesh.FACEMESH_TESSELATION)

				# Use the nose tip (landmark index 1) to track head movement.
				nose = face_landmarks.landmark[1]
				h, w, _ = frame.shape
				nose_x, nose_y = int(nose.x * w), int(nose.y * h)

				# Set the neutral position on the first detected frame.
				if neutral_nose_x is None:
					neutral_nose_x, neutral_nose_y = nose_x, nose_y

				# Calculate movement relative to the neutral position.
				delta_x = (nose_x - neutral_nose_x) * sensitivity
				delta_y = (nose_y - neutral_nose_y) * sensitivity

				# Map head movement to screen coordinates (inverting horizontal movement for intuitiveness).
				cursor_x = screen_width // 2 - delta_x
				cursor_y = screen_height // 2 + delta_y

				# Clamp the cursor position to the screen bounds.
				cursor_x = max(0, min(screen_width, cursor_x))
				cursor_y = max(0, min(screen_height, cursor_y))

				# Move the mouse cursor.
				pyautogui.moveTo(cursor_x, cursor_y, duration=0.05)

				# Draw a small circle on the nose for visual feedback.
				cv2.circle(frame, (nose_x, nose_y), 5, (0, 255, 0), -1)

		# Display the processed frame.
		cv2.imshow("Head Tracking with Scaled Mouse Control", frame)
		if cv2.waitKey(1) & 0xFF == ord('q'):
			break

	cv2.destroyAllWindows()
	client_socket.close()

if __name__ == '__main__':
	main()
