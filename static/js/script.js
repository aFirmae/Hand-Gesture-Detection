document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const themeToggle = document.getElementById('theme-toggle');
    const startCameraBtn = document.getElementById('start-camera');
    const captureButton = document.getElementById('capture-button');
    const cameraFeed = document.getElementById('camera-feed');
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    const detectedSign = document.getElementById('detected-sign');
    
    // Model Training Buttons
    const collectDataBtn = document.getElementById('collect-data');
    const createDatasetBtn = document.getElementById('create-dataset');
    const trainModelBtn = document.getElementById('train-model');
    
    // Modal Elements
    const statusModal = document.getElementById('status-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalClose = document.getElementById('modal-close');
    
    // Socket.io connection
    const socket = io();
    
    // Variables
    let isCameraRunning = false;
    let darkMode = localStorage.getItem('darkMode') === 'true';
    let isCollectingData = false;
    let currentClass = 0;
    let imageCount = 0;
    let totalImagesNeeded = 100;
    let collectionInterval = null;
    
    // Initialize dark mode
    if (darkMode) {
        document.documentElement.classList.add('dark');
    }
    
    // Theme toggle
    themeToggle.addEventListener('click', function() {
        darkMode = !darkMode;
        localStorage.setItem('darkMode', darkMode);
        document.documentElement.classList.toggle('dark');
    });
    
    // Start/Stop Camera
    startCameraBtn.addEventListener('click', function() {
        if (!isCameraRunning) {
            startCamera();
        } else {
            stopCamera();
        }
    });
    
    // Capture Button
    // Update the capture button event listener
    captureButton.addEventListener('click', function() {
        if (cameraFeed.srcObject && cameraFeed.srcObject.active) {
            captureImage();
        } else {
            showModal('Error', 'Please start the camera first.');
        }
    });
    
    function captureImage() {
        if (!isCameraRunning) {
            addMessage('Camera is not running', false);
            return;
        }
        
        // Wait for video to be ready
        if (cameraFeed.readyState === cameraFeed.HAVE_ENOUGH_DATA) {
            // Get the current frame from the video
            const canvas = document.createElement('canvas');
            canvas.width = cameraFeed.videoWidth;
            canvas.height = cameraFeed.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
            
            // Convert to base64
            const imageData = canvas.toDataURL('image/jpeg');
            
            // Send to server
            fetch('/capture_image', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    image_data: imageData
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.status === 'success') {
                    addMessage(`Captured sign: ${data.sign}`, false);
                    updateDetectedSign(data.sign);
                } else {
                    addMessage(data.message, false);
                }
            })
            .catch(error => {
                console.error('Error capturing image:', error);
                addMessage('Error capturing image', false);
            });
        } else {
            addMessage('Video stream is not ready yet', false);
        }
    }
    
    // Send Message
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
    // Model Training Buttons
    collectDataBtn.addEventListener('click', function() {
        if (!isCameraRunning) {
            showModal('Error', 'Please start the camera first.');
            return;
        }
        
        if (isCollectingData) {
            stopCollectingData();
        } else {
            startCollectingData();
        }
    });
    
    createDatasetBtn.addEventListener('click', function() {
        showModal('Creating Dataset', 'Processing images to create the dataset. This may take a while...');
        fetch('/create_dataset', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            updateModal('Dataset Creation', data.message);
        })
        .catch(error => {
            updateModal('Error', 'Failed to create dataset: ' + error);
        });
    });
    
    trainModelBtn.addEventListener('click', function() {
        showModal('Training Model', 'Training the model with the dataset. This may take a while...');
        fetch('/train_model', {
            method: 'POST'
        })
        .then(response => response.json())
        .then(data => {
            updateModal('Model Training', data.message);
        })
        .catch(error => {
            updateModal('Error', 'Failed to train model: ' + error);
        });
    });
    
    // Modal Close Button
    modalClose.addEventListener('click', function() {
        statusModal.classList.add('hidden');
    });
    
    // Socket.io event handlers
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('connect_error', function(error) {
        console.error('Connection error:', error);
        addMessage('Connection error. Please refresh the page.', false);
    });
    
    socket.on('error', function(error) {
        console.error('Socket error:', error);
        addMessage('An error occurred. Please refresh the page.', false);
    });
    
    socket.on('status', function(data) {
        console.log('Status:', data.message);
        addMessage(data.message, false);
    });
    
    socket.on('prediction', function(data) {
        console.log('Prediction:', data.sign);
        updateDetectedSign(data.sign);
    });
    
    // Functions
    function startCamera() {
        const constraints = {
            video: {
                width: { exact: 640 },
                height: { exact: 480 }
            }
        };
        
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showModal('Error', 'Camera API not supported in your browser');
            return;
        }
        
        navigator.mediaDevices.getUserMedia(constraints)
            .then(stream => {
                cameraFeed.srcObject = stream;
                // Set video element dimensions to match constraints
                cameraFeed.width = 640;
                cameraFeed.height = 480;
                return cameraFeed.play();
            })
            .then(() => {
                socket.emit('start_camera');
                // Update UI
                startCameraBtn.querySelector('i').classList.remove('fa-video');
                startCameraBtn.querySelector('i').classList.add('fa-video-slash');
                startCameraBtn.querySelector('span').textContent = 'Stop Camera';
                isCameraRunning = true;
                addMessage("Camera started. Show a hand gesture to detect signs.", false);
            })
            .catch(err => {
                console.error('Error accessing camera:', err);
                if (err.name === 'NotAllowedError') {
                    showModal('Error', 'Camera access denied. Please allow camera access in your browser settings and refresh the page.');
                } else if (err.name === 'ConstraintNotSatisfiedError') {
                    // If exact constraints fail, try with ideal constraints
                    const fallbackConstraints = {
                        video: {
                            width: { ideal: 640 },
                            height: { ideal: 480 }
                        }
                    };
                    return navigator.mediaDevices.getUserMedia(fallbackConstraints);
                } else {
                    showModal('Error', `Could not access camera: ${err.message}`);
                }
            });
    }
    
    function stopCamera() {
        socket.emit('stop_camera');
        
        // Stop all video tracks
        if (cameraFeed.srcObject) {
            cameraFeed.srcObject.getTracks().forEach(track => track.stop());
            cameraFeed.srcObject = null;
        }
        
        // Update UI
        startCameraBtn.querySelector('i').classList.remove('fa-video-slash');
        startCameraBtn.querySelector('i').classList.add('fa-video');
        startCameraBtn.querySelector('span').textContent = 'Start Camera';
        isCameraRunning = false;
        
        // Reset detected sign
        updateDetectedSign('No sign detected');
        
        // Stop collecting data if active
        if (isCollectingData) {
            stopCollectingData();
        }
    }
    
    function startCollectingData() {
        if (!isCameraRunning) {
            showModal('Error', 'Please start the camera first.');
            return;
        }
        
        isCollectingData = true;
        currentClass = parseInt(prompt('Enter class number (0-35):', '0')) || 0;
        imageCount = 0;
        
        // Update UI
        collectDataBtn.textContent = 'Stop Collection';
        collectDataBtn.classList.remove('bg-blue-600', 'dark:bg-blue-500');
        collectDataBtn.classList.add('bg-red-600', 'dark:bg-red-500');
        
        showModal('Data Collection', `Collecting images for class ${currentClass}. Please show the corresponding hand gesture.`);
        
        // Start collecting images
        collectionInterval = setInterval(collectImage, 300); // Collect an image every 300ms
    }
    
    function stopCollectingData() {
        clearInterval(collectionInterval);
        isCollectingData = false;
        
        // Update UI
        collectDataBtn.textContent = 'Collect Images';
        collectDataBtn.innerHTML = '<i class="fas fa-images mr-2"></i>Collect Images';
        collectDataBtn.classList.remove('bg-red-600', 'dark:bg-red-500');
        collectDataBtn.classList.add('bg-blue-600', 'dark:bg-blue-500');
        
        updateModal('Data Collection', `Collection completed. Collected ${imageCount} images for class ${currentClass}.`);
    }
    
    function collectImage() {
        if (!isCameraRunning || !isCollectingData || !cameraFeed.srcObject) {
            return;
        }
        
        // Get the current frame from the video
        const canvas = document.createElement('canvas');
        canvas.width = cameraFeed.videoWidth;
        canvas.height = cameraFeed.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(cameraFeed, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const imageData = canvas.toDataURL('image/jpeg');
        
        // Send to server
        fetch('/collect_data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                class_number: currentClass,
                image_data: imageData
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                imageCount = data.image_count;
                updateModal('Data Collection', `Collecting images for class ${currentClass}. Progress: ${imageCount}/${totalImagesNeeded}`);
                
                // Stop when we have enough images
                if (imageCount >= totalImagesNeeded) {
                    stopCollectingData();
                }
            } else {
                console.error('Error collecting image:', data.message);
            }
        })
        .catch(error => {
            console.error('Error collecting image:', error);
        });
    }
    
    function addMessage(text, isUser = true, imageUrl = null) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isUser 
            ? 'bg-indigo-100 dark:bg-indigo-900/30 p-3 rounded-lg max-w-[80%] ml-auto shadow-md' 
            : 'bg-gray-100 dark:bg-[#334155] p-3 rounded-lg max-w-[80%] shadow-md';
        
        const textElement = document.createElement('p');
        textElement.className = 'text-gray-800 dark:text-gray-200';
        textElement.textContent = text;
        messageDiv.appendChild(textElement);
        
        // If there's an image, add it to the message
        if (imageUrl) {
            const imageElement = document.createElement('img');
            imageElement.src = imageUrl;
            imageElement.className = 'mt-2 rounded-lg max-w-full';
            messageDiv.appendChild(imageElement);
        }
        
        chatMessages.appendChild(messageDiv);
        
        // Scroll to the bottom of the chat
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
    
    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            // Add user message
            addMessage(message, true);
            
            // Clear input field
            messageInput.value = '';
            
            // Simulate response (in a real app, this would be where you process the message)
            setTimeout(() => {
                let response = "I've received your message. Currently, I can only detect hand gestures visually.";
                
                // Simple responses based on keywords
                if (message.toLowerCase().includes('hello') || message.toLowerCase().includes('hi')) {
                    response = "Hello! How can I help you today?";
                } else if (message.toLowerCase().includes('gesture')) {
                    response = "I can detect various hand gestures. Try showing a peace sign, thumbs up, or an open palm to the camera!";
                }
                
                addMessage(response, false);
            }, 1000);
        }
    }
    
    function updateDetectedSign(sign) {
        detectedSign.innerHTML = `<span>${sign}</span>`;
        
        // Add the sign to the chat if it's a new detection
        if (sign !== 'No sign detected') {
            addMessage(`Detected sign: ${sign}`, false);
        }
    }
    
    function showModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        statusModal.classList.remove('hidden');
    }
    
    function updateModal(title, message) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
    }
});