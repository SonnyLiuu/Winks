import cv2
import socket
import struct
import pickle

subscribers = []  # Shared list of subscriber (client) connections

def main():
    # 1. Open the webcam
    print("opening camera")
    cap = cv2.VideoCapture(0) # Or your specific camera index if not 0
    if not cap.isOpened():
        print("Error: Could not open camera.")
        return

    # Attempt to set camera resolution
    print("Setting resolution")
    desired_width = 640
    desired_height = 480
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, desired_width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, desired_height)

    # 2. Create a TCP server socket
    server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # Allow address reuse
    server_socket.bind(('127.0.0.1', 5555))  # Listen on localhost:5555
    server_socket.listen(5)                  # Up to 5 pending connections
    server_socket.setblocking(False) # Non-blocking accept for new connections
    print("Producer: Waiting for subscribers to connect...")

    try:
       # 3. Main loop: continuously capture and broadcast frames
       while True:
          # Try to accept new connections (non-blocking)
          try:
             conn, addr = server_socket.accept()
             print("Producer: Subscriber connected from:", addr)
             conn.setblocking(True) # Set client socket to blocking for sendall
             subscribers.append(conn)
          except BlockingIOError:
             # No new connection available, continue with processing
             pass
          except Exception as e:
             print(f"Producer: Error accepting new connection: {e}")


          ret, frame = cap.read()
          if not ret:
             print("Producer: Failed to capture frame from camera. Exiting.")
             break # Exit if no frame captured

          # Serialize (pickle) the frame
          try:
            data = pickle.dumps(frame)
            # Pack the length of the data (8 bytes for an unsigned long long)
            message_size = struct.pack("Q", len(data))
          except Exception as e:
            print(f"Producer: Error pickling frame: {e}")
            continue # Skip this frame

          # 4. Broadcast to all subscribers
          active_subscribers = []
          for conn_index, conn in enumerate(subscribers):
             try:
                conn.sendall(message_size + data)
                active_subscribers.append(conn)
             except (BrokenPipeError, ConnectionResetError, socket.error) as e:
                # The subscriber has disconnected
                print(f"Producer: A subscriber disconnected or socket error: {e}")
                conn.close() # Ensure the socket is closed
             except Exception as e:
                print(f"Producer: Unexpected error sending data to subscriber: {e}")
                conn.close() # Close on other errors too
          subscribers[:] = active_subscribers

    finally:
       # 5. Cleanup
       print("Producer: Shutting down.")
       cap.release()
       for conn in subscribers:
          try:
            conn.close()
          except:
            pass
       server_socket.close()

if __name__ == '__main__':
    main()