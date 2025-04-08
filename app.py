import os
import time
import cv2
import pickle
import numpy as np
import mediapipe as mp
import base64
from flask import Flask, render_template, Response, jsonify, request
from flask_socketio import SocketIO, emit
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
socketio = SocketIO(app, cors_allowed_origins="*")

# Global variables
camera = None
is_camera_running = False
model = None
model_loaded = False
mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

# Initialize hands with solution_options parameter
hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5
)

# Labels dictionary for ASL signs
labels_dict = {i: str(i) for i in range(10)}  # 0-9
labels_dict.update({i + 10: chr(i + 65) for i in range(26)})  # A-Z

def get_model():
    model_dict = pickle.load(open('./model.p', 'rb'))
    return model_dict['model']

def load_model():
    global model, model_loaded
    try:
        model_path = './model.p'
        if not os.path.exists(model_path):
            print(f"Model file not found at {os.path.abspath(model_path)}")
            print("You may need to train the model first using the 'Train Model' button")
            model_loaded = False
            return
            
        model = get_model()
        model_loaded = True
        print("Model loaded successfully")
    except Exception as e:
        print(f"Error loading model: {e}")
        model_loaded = False

def process_frame(frame, model):
    data_aux = []
    x_ = []
    y_ = []
    prediction = None
    
    # Flip the frame horizontally for a later selfie-view display
    frame = cv2.flip(frame, 1)
    
    # Convert BGR to RGB
    frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    
    # Process the frame with MediaPipe
    results = hands.process(frame_rgb)
    
    if results.multi_hand_landmarks:
        for hand_landmarks in results.multi_hand_landmarks:
            # Draw hand landmarks
            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS,
                mp_drawing.DrawingSpec(color=(0, 255, 0), thickness=2, circle_radius=4),
                mp_drawing.DrawingSpec(color=(0, 0, 255), thickness=2)
            )
            
            # Extract coordinates
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                
                x_.append(x)
                y_.append(y)
            
            # Normalize coordinates
            for i in range(len(hand_landmarks.landmark)):
                x = hand_landmarks.landmark[i].x
                y = hand_landmarks.landmark[i].y
                data_aux.append(x - min(x_))
                data_aux.append(y - min(y_))
            
            # Make prediction if model is loaded and data has correct dimensions
            if model_loaded and len(data_aux) == model.n_features_in_:
                prediction = model.predict([np.asarray(data_aux)])
                predicted_character = labels_dict[int(prediction[0])]
                
                # Draw prediction on frame
                cv2.putText(frame, predicted_character, (10, 70), cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 3, cv2.LINE_AA)
                
                # Return the predicted character
                prediction = predicted_character
    
    return frame, prediction

@app.route('/')
def index():
    return render_template('index.html')

def generate_frames():
    global camera, is_camera_running
    
    try:
        while is_camera_running:
            if camera is None or not camera.isOpened():
                camera = cv2.VideoCapture(0)
                if not camera.isOpened():
                    print("Error: Could not open camera.")
                    yield (b'--frame\r\n'
                           b'Content-Type: text/plain\r\n\r\n' + b'Camera not available' + b'\r\n')
                    return
            
            success, frame = camera.read()
            if not success:
                print("Error: Could not read frame.")
                break
            
            if model_loaded:
                try:
                    frame, prediction = process_frame(frame, model)
                    if prediction:
                        socketio.emit('prediction', {'sign': prediction})
                except Exception as e:
                    print(f"Error processing frame: {e}")
            
            ret, buffer = cv2.imencode('.jpg', frame)
            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            time.sleep(0.03)
    except Exception as e:
        print(f"Error in generate_frames: {e}")
        socketio.emit('status', {'message': f'Camera error: {str(e)}'})
        yield (b'--frame\r\n'
               b'Content-Type: text/plain\r\n\r\n' + str(e).encode() + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')

@socketio.on('start_camera')
def handle_start_camera():
    global is_camera_running, camera
    
    try:
        if not is_camera_running:
            # Initialize camera if not already initialized
            if camera is None:
                camera = cv2.VideoCapture(0)
                if not camera.isOpened():
                    raise Exception("Could not open camera")
            
            is_camera_running = True
            
            # Load model if not already loaded
            if not model_loaded:
                load_model()
                
            emit('status', {'message': 'Camera started successfully'})
        else:
            emit('status', {'message': 'Camera already running'})
    except Exception as e:
        print(f"Error starting camera: {e}")
        emit('status', {'message': f'Error starting camera: {str(e)}'})
        if camera is not None:
            camera.release()
            camera = None
        is_camera_running = False

@socketio.on('stop_camera')
def handle_stop_camera():
    global is_camera_running, camera
    
    is_camera_running = False
    if camera is not None:
        camera.release()
        camera = None
    emit('status', {'message': 'Camera stopped'})

@app.route('/collect_data', methods=['POST'])
def collect_data():
    try:
        # Get the class number from the request
        class_number = request.json.get('class_number', 0)
        
        # Create directory if it doesn't exist
        DATA_DIR = './data'
        if not os.path.exists(DATA_DIR):
            os.makedirs(DATA_DIR)
            
        class_dir = os.path.join(DATA_DIR, str(class_number))
        if not os.path.exists(class_dir):
            os.makedirs(class_dir)
            
        # Get the image data from the request
        image_data = request.json.get('image_data', '')
        if not image_data:
            return jsonify({'status': 'error', 'message': 'No image data provided'})
            
        # Convert base64 to image
        image_data = image_data.split(',')[1]
        image_bytes = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        
        # Get the next image number
        image_count = len(os.listdir(class_dir))
        
        # Save the image
        cv2.imwrite(os.path.join(class_dir, f'{image_count}.jpg'), image)
        
        return jsonify({
            'status': 'success', 
            'message': f'Image saved for class {class_number}',
            'image_count': image_count + 1,
            'total_needed': 100
        })
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error: {str(e)}'})

@app.route('/create_dataset', methods=['POST'])
def create_dataset():
    try:
        # Run the dataset creation script in a separate process
        import subprocess
        import sys
        
        # Get the path to the Python interpreter
        python_executable = sys.executable
        
        # Run the script using the same Python interpreter
        process = subprocess.Popen([python_executable, 'create_dataset.py'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE)
        
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            return jsonify({'status': 'error', 'message': f'Error creating dataset: {stderr.decode()}'})
        
        return jsonify({'status': 'success', 'message': 'Dataset created successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error: {str(e)}'})

@app.route('/train_model', methods=['POST'])
def train_model():
    try:
        # Run the model training script in a separate process
        import subprocess
        import sys
        
        # Get the path to the Python interpreter
        python_executable = sys.executable
        
        # Run the script using the same Python interpreter
        process = subprocess.Popen([python_executable, 'train_classifier.py'], 
                                  stdout=subprocess.PIPE, 
                                  stderr=subprocess.PIPE)
        
        stdout, stderr = process.communicate()
        
        if process.returncode != 0:
            return jsonify({'status': 'error', 'message': f'Error training model: {stderr.decode()}'})
        
        # Reload the model after training
        load_model()
        
        return jsonify({'status': 'success', 'message': 'Model trained successfully'})
    except Exception as e:
        return jsonify({'status': 'error', 'message': f'Error: {str(e)}'})

@app.route('/capture_image', methods=['POST'])
def capture_image():
    try:
        # Get the image data from the request
        image_data = request.json.get('image_data', '')
        if not image_data:
            return jsonify({'status': 'error', 'message': 'No image data provided'})
            
        # Convert base64 to image
        image_data = image_data.split(',')[1]
        image_bytes = np.frombuffer(base64.b64decode(image_data), np.uint8)
        image = cv2.imdecode(image_bytes, cv2.IMREAD_COLOR)
        
        if model_loaded:
            frame, prediction = process_frame(image, model)
            if prediction:
                return jsonify({'status': 'success', 'sign': prediction})
        
        return jsonify({'status': 'error', 'message': 'No hand detected or model not loaded'})
    except Exception as e:
        print(f"Error in capture_image: {e}")
        return jsonify({'status': 'error', 'message': f'Error processing image: {str(e)}'})

if __name__ == '__main__':
    try:
        socketio.run(app, debug=True, host='0.0.0.0', port=8000, allow_unsafe_werkzeug=True)
    except Exception as e:
        print(f"Error starting server: {e}")
        if camera is not None:
            camera.release()