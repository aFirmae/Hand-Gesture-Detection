// DOM Elements
document.addEventListener('DOMContentLoaded', () => {
    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    const html = document.documentElement;
    
    // Check for saved theme preference or use system preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        html.classList.add('dark');
    } else {
        html.classList.remove('dark');
    }
    
    // Theme toggle event listener
    themeToggle.addEventListener('click', () => {
        html.classList.toggle('dark');
        
        // Save preference to localStorage
        if (html.classList.contains('dark')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Camera functionality
    const videoElement = document.getElementById('camera-feed');
    const startButton = document.getElementById('start-camera');
    const captureButton = document.getElementById('capture-button');
    let stream = null;
    
    startButton.addEventListener('click', async () => {
        if (!stream) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ 
                    video: { 
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    } 
                });
                videoElement.srcObject = stream;
                startButton.innerHTML = '<i class="fas fa-stop w-5 text-center"></i><span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[100px] transition-all duration-300 ease-in-out ml-0 group-hover:ml-2">Stop Camera</span>';
                startButton.classList.remove('bg-indigo-600', 'dark:bg-indigo-500', 'hover:bg-indigo-700', 'dark:hover:bg-indigo-600');
                startButton.classList.add('bg-red-600', 'dark:bg-red-500', 'hover:bg-red-700', 'dark:hover:bg-red-600');
                
                // Enable capture button when camera is on
                captureButton.disabled = false;
                captureButton.classList.remove('opacity-50', 'cursor-not-allowed');
            } catch (err) {
                console.error('Error accessing camera:', err);
                alert('Error accessing camera. Please make sure you have granted camera permissions.');
            }
        } else {
            stream.getTracks().forEach(track => track.stop());
            videoElement.srcObject = null;
            stream = null;
            startButton.innerHTML = '<i class="fas fa-video w-5 text-center"></i><span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-[100px] transition-all duration-300 ease-in-out ml-0 group-hover:ml-2">Start Camera</span>';
            startButton.classList.remove('bg-red-600', 'dark:bg-red-500', 'hover:bg-red-700', 'dark:hover:bg-red-600');
            startButton.classList.add('bg-indigo-600', 'dark:bg-indigo-500', 'hover:bg-indigo-700', 'dark:hover:bg-indigo-600');
            
            // Disable capture button when camera is off
            captureButton.disabled = true;
            captureButton.classList.add('opacity-50', 'cursor-not-allowed');
        }
    });
    
    // Capture button functionality
    captureButton.addEventListener('click', () => {
        if (!stream) {
            alert('Please start the camera first.');
            return;
        }
        
        // Create a canvas element to capture the current video frame
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        const ctx = canvas.getContext('2d');
        
        // Draw the current video frame on the canvas (flipped horizontally to match the display)
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
        
        // Convert the canvas to a data URL
        const imageDataUrl = canvas.toDataURL('image/png');
        
        // Add a message to the chat with the captured image
        addMessage('Captured image:', true, imageDataUrl);
    });
    
    // Chat functionality
    const chatMessages = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-button');
    
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
    
    // Send message when clicking the send button
    sendButton.addEventListener('click', () => {
        sendMessage();
    });
    
    // Send message when pressing Enter in the input field
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
    
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
    
    // Initialize - disable capture button until camera is started
    captureButton.disabled = true;
    captureButton.classList.add('opacity-50', 'cursor-not-allowed');
});