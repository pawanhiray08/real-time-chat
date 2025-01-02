// Connect to Socket.io server
const socket = io({
    path: '/socket.io',
    withCredentials: true,
    transports: ['websocket', 'polling'],
    auth: {
        serverUrl: window.location.origin
    }
});

// DOM elements
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');
const sendButton = document.getElementById('send-button');
const messageTemplate = document.getElementById('message-template');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// Typing timer and state
let typingTimeout;
let currentUser = null;
let isTyping = false;

// Initialize connection and get user data
fetch('/api/user')
    .then(response => response.json())
    .then(user => {
        currentUser = user;
        userAvatar.style.backgroundImage = `url(${user.avatar})`;
        userName.textContent = user.displayName;
    });

// Load previous messages
socket.on('previousMessages', (messages) => {
    messages.forEach(message => {
        appendMessage(message);
    });
    scrollToBottom();
});

// Handle new messages
socket.on('newMessage', (message) => {
    appendMessage(message);
    scrollToBottom();
});

// Handle input changes for typing indicator
messageInput.addEventListener('input', (e) => {
    const text = e.target.value.trim();
    
    // Emit typing event with current text
    socket.emit('typing', { text: text });
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Set new timeout
    typingTimeout = setTimeout(() => {
        socket.emit('stopTyping');
    }, 1000);
});

// Handle when user stops typing
messageInput.addEventListener('blur', () => {
    clearTimeout(typingTimeout);
    socket.emit('stopTyping');
});

// Handle send button click
sendButton.addEventListener('click', sendMessage);

// Handle enter key press
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Send message function
function sendMessage() {
    const message = messageInput.value.trim();
    if (message) {
        socket.emit('sendMessage', message);
        messageInput.value = '';
        // Clear typing status
        socket.emit('stopTyping');
    }
}

// Listen for typing from other users
socket.on('userTyping', (data) => {
    const typingElement = document.getElementById(`typing-${data.userId}`);
    
    if (data.isTyping) {
        if (!typingElement) {
            // Create typing indicator
            const typingDiv = document.createElement('div');
            typingDiv.id = `typing-${data.userId}`;
            typingDiv.className = 'typing-indicator-item';
            
            const avatar = document.createElement('div');
            avatar.className = 'typing-avatar';
            avatar.style.backgroundImage = `url(${data.avatar})`;
            
            const text = document.createElement('span');
            text.className = 'typing-text';
            
            const name = document.createElement('span');
            name.className = 'typing-name';
            name.textContent = data.displayName;
            
            const preview = document.createElement('span');
            preview.className = 'typing-preview';
            preview.textContent = data.text || 'is typing...';
            
            text.appendChild(name);
            text.appendChild(document.createTextNode(': '));
            text.appendChild(preview);
            
            typingDiv.appendChild(avatar);
            typingDiv.appendChild(text);
            
            typingIndicator.appendChild(typingDiv);
        } else {
            // Update existing typing indicator
            const preview = typingElement.querySelector('.typing-preview');
            preview.textContent = data.text || 'is typing...';
        }
    } else if (!data.isTyping && typingElement) {
        typingElement.remove();
    }
});

// Append message to chat
function appendMessage(message) {
    const messageDiv = messageTemplate.content.cloneNode(true);
    const messageElement = messageDiv.querySelector('.message');
    
    if (message.sender._id === currentUser?.id) {
        messageElement.classList.add('self');
    }
    
    const avatar = messageElement.querySelector('.message-avatar');
    avatar.style.backgroundImage = `url(${message.sender.avatar})`;
    
    const author = messageElement.querySelector('.message-author');
    author.textContent = message.sender.displayName;
    
    const messageText = messageElement.querySelector('.message-text');
    messageText.textContent = message.text;
    
    const timestamp = messageElement.querySelector('.message-timestamp');
    timestamp.textContent = formatTimestamp(message.timestamp);
    
    chatMessages.appendChild(messageElement);
}

// Format timestamp
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Scroll chat to bottom
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
