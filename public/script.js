// Connect to Socket.io server
const socket = io();

// DOM elements
const messageInput = document.getElementById('message-input');
const chatMessages = document.getElementById('chat-messages');
const typingIndicator = document.getElementById('typing-indicator');
const sendButton = document.getElementById('send-button');
const messageTemplate = document.getElementById('message-template');
const userAvatar = document.getElementById('user-avatar');
const userName = document.getElementById('user-name');

// Typing timer
let typingTimeout;
let currentUser = null;

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

// Handle input changes
messageInput.addEventListener('input', (e) => {
    // Send the current input value to other users
    socket.emit('typing', e.target.value);
    
    // Handle typing indicator
    socket.emit('typingStatus', true);
    
    // Clear previous timeout
    clearTimeout(typingTimeout);
    
    // Set new timeout
    typingTimeout = setTimeout(() => {
        socket.emit('typingStatus', false);
    }, 1000);
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
        socket.emit('typingStatus', false);
    }
}

// Listen for typing from other users
socket.on('userTyping', (data) => {
    const typingMessage = document.getElementById(`typing-${data.userId}`);
    if (data.text && !typingMessage) {
        const messageDiv = messageTemplate.content.cloneNode(true);
        const message = messageDiv.querySelector('.message');
        message.id = `typing-${data.userId}`;
        message.classList.add('typing');
        
        const avatar = message.querySelector('.message-avatar');
        avatar.style.backgroundImage = `url(${data.user.avatar})`;
        
        const author = message.querySelector('.message-author');
        author.textContent = data.user.displayName;
        
        const messageText = message.querySelector('.message-text');
        messageText.textContent = data.text;
        
        chatMessages.appendChild(message);
        scrollToBottom();
    } else if (typingMessage) {
        typingMessage.querySelector('.message-text').textContent = data.text;
        if (!data.text) {
            typingMessage.remove();
        }
    }
});

// Listen for typing status
socket.on('userTypingStatus', (data) => {
    const userId = data.userId;
    const isTyping = data.isTyping;
    
    let statusElement = document.getElementById(`status-${userId}`);
    
    if (isTyping && !statusElement) {
        statusElement = document.createElement('div');
        statusElement.id = `status-${userId}`;
        statusElement.className = 'typing-status';
        
        const avatar = document.createElement('div');
        avatar.className = 'typing-avatar';
        avatar.style.backgroundImage = `url(${data.user.avatar})`;
        
        statusElement.appendChild(avatar);
        statusElement.appendChild(document.createTextNode(`${data.user.displayName} is typing...`));
        
        typingIndicator.appendChild(statusElement);
    } else if (!isTyping && statusElement) {
        statusElement.remove();
    }
});

// Append message to chat
function appendMessage(message) {
    // Remove typing message if exists
    const typingMessage = document.getElementById(`typing-${message.sender._id}`);
    if (typingMessage) {
        typingMessage.remove();
    }
    
    const messageDiv = messageTemplate.content.cloneNode(true);
    const messageElement = messageDiv.querySelector('.message');
    
    if (message.sender._id === currentUser?._id) {
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
