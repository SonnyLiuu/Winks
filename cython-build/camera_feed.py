import cv2
import socket
import struct
import pickle

subscribers = []  # Shared list of subscriber (client) connections

def main():
	# 1. Open the webcam
	cap = cv2.VideoCapture(0)
	if not cap.isOpened():
		print("Error: Could not open camera.")
		return

	# 2. Create a TCP server socket
	server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
	server_socket.bind(('127.0.0.1', 5555))  # Listen on localhost:5555
	server_socket.listen(5)                  # Up to 5 pending connections
	# Set the server socket to non-blocking mode so accept() doesn't block the loop
	server_socket.setblocking(False)
	print("Producer: Waiting for subscribers to connect...")

	try:
		# 3. Main loop: continuously capture and broadcast frames
		while True:
			# Try to accept new connections (non-blocking)
			try:
				conn, addr = server_socket.accept()
				print("Producer: Subscriber connected from:", addr)
				# Set the accepted connection to blocking mode for sendall() to work reliably
				conn.setblocking(True)
				subscribers.append(conn)
			except BlockingIOError:
				# No new connection available, continue with processing
				pass

			ret, frame = cap.read()
			if not ret:
				break

			# Serialize (pickle) the frame
			data = pickle.dumps(frame)
			# Pack the length of the data (8 bytes for an unsigned long long)
			message_size = struct.pack("Q", len(data))

			# 4. Broadcast to all subscribers
			active_subscribers = []
			for conn in subscribers:
				try:
					conn.sendall(message_size + data)
					active_subscribers.append(conn)
				except (BrokenPipeError, ConnectionResetError):
					# The subscriber has disconnected
					print("Producer: A subscriber disconnected.")
			# Update the global subscriber list (remove disconnected ones)
			subscribers[:] = active_subscribers

	finally:
		# 5. Cleanup
		cap.release()
		for conn in subscribers:
			conn.close()
		server_socket.close()

if __name__ == '__main__':
	main()
